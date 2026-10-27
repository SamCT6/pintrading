import { useEffect, useMemo, useState } from "react";
import { Search, Upload, Layers3, CircleHelp, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { supabase } from "../lib/supabase";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(field.trim());
      if (row.some(value => value !== "")) rows.push(row);
      row = []; field = "";
    } else field += c;
  }
  row.push(field.trim());
  if (row.some(value => value !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.map(values => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
}

async function fetchAll(table, select) {
  const all = [];
  for (let start = 0; ; start += 1000) {
    let query = supabase.from(table).select(select);
    if (table === "pins") query = query.eq("is_catalog", true);
    const { data, error } = await query.range(start, start + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export default function Catalog({ userId }) {
  const [sets, setSets] = useState([]);
  const [pins, setPins] = useState([]);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCatalog() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [setRows, pinRows, inventory] = await Promise.all([
        fetchAll("pin_sets", "id, name, franchise, release_year, image_url, description"),
        fetchAll("pins", "id, name, description, character_name, franchise, park, release_year, edition_type, image_url, catalog_code, pin_set_id, set_number, is_catalog"),
        fetchAll("collection_items", "pin_id, owned_quantity").then(rows => rows.filter(row => Number(row.owned_quantity) > 0)),
      ]);
      setSets(setRows);
      setPins(pinRows);
      setOwnedIds(new Set(inventory.map(row => row.pin_id)));
    } catch (e) { setError(e.message || "Could not load the pin catalog."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadCatalog(); }, [userId]);

  const setById = useMemo(() => new Map(sets.map(set => [set.id, set])), [sets]);
  const filteredPins = useMemo(() => pins.filter(pin => {
    const setName = setById.get(pin.pin_set_id)?.name || "";
    const text = `${pin.name} ${pin.character_name || ""} ${pin.franchise || ""} ${pin.park || ""} ${setName} ${pin.catalog_code || ""}`.toLowerCase();
    if (search && !text.includes(search.toLowerCase())) return false;
    if (filter === "sets" && !pin.pin_set_id) return false;
    if (filter === "standalone" && pin.pin_set_id) return false;
    if (filter === "owned" && !ownedIds.has(pin.id)) return false;
    if (filter === "missing" && ownedIds.has(pin.id)) return false;
    return true;
  }), [pins, setById, search, filter, ownedIds]);

  const setCards = useMemo(() => sets.map(set => {
    const setPins = filteredPins.filter(pin => pin.pin_set_id === set.id);
    const allSetPins = pins.filter(pin => pin.pin_set_id === set.id);
    const owned = allSetPins.filter(pin => ownedIds.has(pin.id)).length;
    return { ...set, visiblePins: setPins, pinCount: allSetPins.length, ownedCount: owned };
  }).filter(set => set.visiblePins.length > 0 || (!search && filter === "sets")), [sets, pins, filteredPins, ownedIds, search, filter]);
  const standalonePins = filteredPins.filter(pin => !pin.pin_set_id);

  async function importCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !userId) return;
    setImporting(true); setMessage(""); setError("");
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("CSV is empty or has no data rows. Use the provided template headers.");
      if (!rows[0].catalog_code || !rows[0].name) throw new Error("Each row needs catalog_code and name columns.");
      const cleaned = rows.filter(row => row.catalog_code && row.name).map(row => ({
        ...row,
        set_name: (row.set_name || "").trim(),
        catalog_code: row.catalog_code.trim(),
        name: row.name.trim(),
      }));
      if (!cleaned.length) throw new Error("No rows had both catalog_code and name.");

      const uniqueSetNames = [...new Set(cleaned.map(r => r.set_name).filter(Boolean))];
      let existingSets = await fetchAll("pin_sets", "id,name");
      const setIds = new Map(existingSets.map(s => [s.name.trim().toLowerCase(), s.id]));
      for (const name of uniqueSetNames) {
        if (setIds.has(name.toLowerCase())) continue;
        const first = cleaned.find(r => r.set_name === name);
        const { data, error: setError } = await supabase.from("pin_sets").insert({
          name, franchise: first.franchise || null,
          release_year: first.release_year ? Number(first.release_year) || null : null,
          description: first.set_description || null,
          created_by: userId,
        }).select("id,name").single();
        if (setError) throw setError;
        setIds.set(name.toLowerCase(), data.id);
      }

      const existingCodes = new Set();
      for (let start = 0; ; start += 1000) {
        const { data, error: codeError } = await supabase.from("pins").select("catalog_code").not("catalog_code", "is", null).range(start, start + 999);
        if (codeError) throw codeError;
        (data || []).forEach(item => existingCodes.add(item.catalog_code));
        if (!data || data.length < 1000) break;
      }
      const seen = new Set(existingCodes);
      const newPins = [];
      let skipped = 0;
      for (const row of cleaned) {
        if (seen.has(row.catalog_code)) { skipped++; continue; }
        seen.add(row.catalog_code);
        newPins.push({
          catalog_code: row.catalog_code, name: row.name,
          description: row.description || null,
          character_name: row.character_name || null,
          franchise: row.franchise || null, park: row.park || null,
          release_year: row.release_year ? Number(row.release_year) || null : null,
          edition_type: row.edition_type || null,
          image_url: row.image_url || null,
          set_number: row.set_number || null,
          pin_set_id: row.set_name ? (setIds.get(row.set_name.toLowerCase()) || null) : null,
          created_by: userId,
          is_catalog: true,
        });
      }
      for (let i = 0; i < newPins.length; i += 250) {
        const { error: pinError } = await supabase.from("pins").insert(newPins.slice(i, i + 250));
        if (pinError) throw pinError;
      }
      setMessage(`Imported ${newPins.length.toLocaleString()} pins; skipped ${skipped.toLocaleString()} existing catalog codes.`);
      await loadCatalog();
    } catch (e) { setError(e.message || "CSV import failed."); }
    finally { setImporting(false); }
  }

  const downloadTemplate = () => {
    const csv = "catalog_code,name,set_name,character_name,franchise,park,release_year,edition_type,set_number,image_url,description,set_description\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "pinfolio-pin-catalog-template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return <>
    <div className="section-title"><div><div className="eyebrow">DISCOVER & TRACK</div><h1>Pin Catalog</h1><p>Browse pin sets, see your progress, and find pins you’re still missing.</p></div><button className="button button-secondary" onClick={downloadTemplate}>CSV template</button></div>
    <div className="catalog-import panel">
      <div className="catalog-import-copy"><div className="catalog-import-icon"><Upload size={18}/></div><div><strong>Import a pin catalog</strong><p>Load a large CSV catalog. Existing catalog codes are skipped to avoid duplicates.</p></div></div>
      <label className={`button button-gold catalog-upload ${importing ? "disabled" : ""}`}>
        <Upload size={16}/>{importing ? "Importing…" : "Import CSV"}<input type="file" accept=".csv,text/csv" disabled={importing} onChange={importCsv} hidden />
      </label>
    </div>
    {message && <div className="catalog-message success"><CheckCircle2 size={16}/>{message}</div>}
    {error && <div className="catalog-message error"><CircleHelp size={16}/>{error}</div>}
    <div className="catalog-stats"><div><span>Catalog pins</span><strong>{pins.length.toLocaleString()}</strong></div><div><span>Sets</span><strong>{sets.length.toLocaleString()}</strong></div><div><span>In your collection</span><strong>{pins.filter(pin => ownedIds.has(pin.id)).length.toLocaleString()}</strong></div><div><span>Standalone pins</span><strong>{pins.filter(pin => !pin.pin_set_id).length.toLocaleString()}</strong></div></div>
    <div className="toolbar catalog-toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pins, characters, sets, catalog code…"/></div></div>
    <div className="filter-chips catalog-filters">{[{id:"all",label:"All pins"},{id:"sets",label:"Pins in sets"},{id:"standalone",label:"Not in sets"},{id:"owned",label:"I own"},{id:"missing",label:"Still need"}].map(item => <button key={item.id} className={`chip ${filter===item.id?"active":""}`} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {loading ? <div className="panel">Loading catalog…</div> : error && !pins.length ? <div className="panel">The catalog could not be loaded. Check the migration and Supabase permissions.</div> : !pins.length ? <div className="panel catalog-empty"><Layers3 size={30}/><h2>Your catalog is ready for data</h2><p>Import a licensed, accurate CSV of Disney pins to populate current and historical sets. The catalog feature is ready, but a complete catalog dataset has not been bundled because its accuracy and image/data rights need to be verified.</p><button className="button button-gold" onClick={downloadTemplate}>Download CSV template</button></div> : <>
      {(filter !== "standalone") && setCards.map(set => <section className="catalog-set" key={set.id}><div className="catalog-set-heading"><div className="catalog-set-mark"><Layers3 size={19}/></div><div className="catalog-set-title"><h2>{set.name}</h2><p>{[set.franchise, set.release_year].filter(Boolean).join(" · ") || "Disney pin set"}</p></div><div className="catalog-progress"><strong>{set.ownedCount}/{set.pinCount}</strong><span>collected</span></div></div><div className="catalog-progress-track"><span style={{width: `${set.pinCount ? set.ownedCount / set.pinCount * 100 : 0}%`}}/></div><div className="catalog-pin-grid">{set.visiblePins.map(pin => <CatalogPin key={pin.id} pin={pin} owned={ownedIds.has(pin.id)} userId={userId} onAdded={loadCatalog} setMessage={setMessage} setError={setError}/>)}</div></section>)}
      {(filter !== "sets") && standalonePins.length > 0 && <section className="catalog-set"><div className="catalog-set-heading"><div className="catalog-set-mark"><ImageIcon size={19}/></div><div className="catalog-set-title"><h2>Pins Not in Sets</h2><p>Individual releases and standalone pins</p></div><div className="catalog-progress"><strong>{standalonePins.filter(pin => ownedIds.has(pin.id)).length}/{standalonePins.length}</strong><span>collected</span></div></div><div className="catalog-pin-grid">{standalonePins.map(pin => <CatalogPin key={pin.id} pin={pin} owned={ownedIds.has(pin.id)} userId={userId} onAdded={loadCatalog} setMessage={setMessage} setError={setError}/>)}</div></section>}
      {filteredPins.length === 0 && <div className="panel catalog-empty"><Search size={24}/><h2>No pins match</h2><p>Try a different search or filter.</p></div>}
    </>}
    <p className="catalog-footnote">Collection progress is based on catalog pins matched to your own inventory. Catalog images and data should come from sources you’re authorized to import.</p>
  </>;
}

function CatalogPin({ pin, owned, userId, onAdded, setMessage, setError }) {
  const [adding, setAdding] = useState(false);
  async function addToCollection() {
    if (!supabase || !userId || adding) return;
    setAdding(true); setMessage(""); setError("");
    try {
      const { data: existing, error: lookupError } = await supabase.from("collection_items").select("id,owned_quantity,tradeable_quantity").eq("user_id", userId).eq("pin_id", pin.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        const { error: updateError } = await supabase.from("collection_items").update({ owned_quantity: Number(existing.owned_quantity || 0) + 1 }).eq("id", existing.id).eq("user_id", userId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("collection_items").insert({ user_id: userId, pin_id: pin.id, owned_quantity: 1, tradeable_quantity: 0, visibility: "private", authenticity_status: "unknown" });
        if (insertError) throw insertError;
      }
      setMessage(`${pin.name} added to your collection.`);
      await onAdded();
    } catch (e) { setError(e.message || "Could not add this pin to your collection."); }
    finally { setAdding(false); }
  }
  return <article className={`catalog-pin ${owned ? "catalog-pin-owned" : ""}`}><div className="catalog-pin-art">{pin.image_url ? <img src={pin.image_url} alt={pin.name} loading="lazy"/> : <span>✦</span>}{owned && <span className="catalog-owned-check"><CheckCircle2 size={15}/></span>}</div><div className="catalog-pin-info"><strong title={pin.name}>{pin.name}</strong><span>{[pin.character_name, pin.release_year].filter(Boolean).join(" · ") || pin.franchise || pin.park || "Disney pin"}</span>{pin.set_number && <small>#{pin.set_number}</small>}<button className="catalog-add-button" onClick={addToCollection} disabled={adding}>{adding ? "Adding…" : owned ? "+ Add another" : "+ Add to collection"}</button></div></article>;
}
