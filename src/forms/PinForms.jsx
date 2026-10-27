import { useEffect, useState } from "react";
import {
  LayoutDashboard, GalleryVerticalEnd, Repeat2, Heart, MoreHorizontal,
  Search, Bell, Plus, ChevronRight, ArrowUpRight, LockKeyhole,
  SlidersHorizontal, Sparkles, ShieldCheck, Menu, X, CircleHelp,
  Settings, Layers3, ChartNoAxesCombined, ImagePlus, EyeOff, Clock3,
  CheckCircle2, Handshake, ArrowRightLeft
} from "lucide-react";
import { supabase, isDemoMode } from "../lib/supabase";

import { PinArt, SectionTitle } from "../components/AppViews.jsx";

export function PinDetail({ pin, onClose, onEdit, onRemove }) {
  if (!pin) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="pin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close pin details"
        >
          <X size={20} />
        </button>

        <PinArt pin={pin} />

        <div className="eyebrow">MY COLLECTION</div>
        <h2 id="pin-detail-title">{pin.name}</h2>
        <p>{pin.set} · {pin.character}</p>

        <div className="detail-stats">
          <div>
            <span>Owned</span>
            <strong>{pin.owned}</strong>
          </div>
          <div>
            <span>Tradeable</span>
            <strong>{pin.tradeable}</strong>
          </div>
          <div>
            <span>Visibility</span>
            <strong>{pin.visibility}</strong>
          </div>
        </div>

        {pin.purchaseCost != null && (
          <p>
            <strong>Purchase cost:</strong>{" "}
            ${Number(pin.purchaseCost).toFixed(2)}
          </p>
        )}

        {pin.notes && (
          <p>
            <strong>Notes:</strong> {pin.notes}
          </p>
        )}

        {pin.authenticityStatus && (
          <p>
            <strong>Authenticity:</strong>{" "}
            {pin.authenticityStatus.replaceAll("_", " ")}
          </p>
        )}

        <div className="add-pin-fields">
          <button
            className="button button-gold button-wide"
            type="button"
            onClick={() => onEdit(pin)}
          >
            Edit pin
          </button>

          <button
            className="button button-secondary button-wide"
            type="button"
            onClick={() => onRemove(pin)}
          >
            Remove from collection
          </button>
        </div>
      </div>
    </div>
  );
}



export function AddPinForm({ onClose, onSaved, userId }) {
  const [mode, setMode] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [name, setName] = useState("");
  const [character, setCharacter] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [franchise, setFranchise] = useState("");
  const [park, setPark] = useState("");
  const [year, setYear] = useState("");
  const [owned, setOwned] = useState("1");
  const [tradeable, setTradeable] = useState("0");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function searchCatalog() {
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    
    const searchTerm = query.trim();

    let catalogQuery = supabase
      .from("pins")
      .select("id, name, character_name, franchise, park, release_year")
      .order("name")
      .limit(20);

    if (searchTerm) {
      catalogQuery = catalogQuery.or(
        `name.ilike.%${searchTerm}%,character_name.ilike.%${searchTerm}%,franchise.ilike.%${searchTerm}%,park.ilike.%${searchTerm}%`
      );
    }

    const { data, error } = await catalogQuery;


    if (error) {
      setMessage(error.message);
    } else {
      setResults(data ?? []);
      if (!data?.length) setMessage("No matching pins found. You can create a new entry.");
    }
    setBusy(false);
  }

  async function savePin(e) {
    e.preventDefault();
    setMessage("");

    const ownedCount = Number(owned);
    const tradeableCount = Number(tradeable);
    const purchaseCost = cost.trim() === "" ? null : Number(cost);

    if (!Number.isInteger(ownedCount) || ownedCount < 1) {
      setMessage("Quantity owned must be at least 1.");
      return;
    }
    if (!Number.isInteger(tradeableCount) || tradeableCount < 0 || tradeableCount > ownedCount) {
      setMessage("Tradeable quantity must be between 0 and quantity owned.");
      return;
    }
    if (purchaseCost !== null && (!Number.isFinite(purchaseCost) || purchaseCost < 0)) {
      setMessage("Enter a valid purchase cost.");
      return;
    }

    setBusy(true);

    try {
      let pinId = selectedPin?.id;

      
      if (mode === "create") {
        if (!name.trim()) throw new Error("Pin name is required.");

        let imagePath = null;

        if (imageFile) {
          const fileExtension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
          imagePath = `${userId}/${crypto.randomUUID()}.${fileExtension}`;
          const { error: uploadError } = await supabase.storage
            .from("pin-images")
            .upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
          if (uploadError) throw uploadError;
        }

        const { data: newPin, error: pinError } = await supabase
          .from("pins")
          .insert({
            name: name.trim(),
            character_name: character.trim() || null,
            franchise: franchise.trim() || null,
            park: park.trim() || null,
            release_year: year ? Number(year) : null,
            image_url: null,
            image_path: imagePath,
            created_by: userId,
          })
          .select("id")
          .single();

        if (pinError) throw pinError;
        pinId = newPin.id;
      }

      if (!pinId) throw new Error("Choose a catalog pin or create a new one.");

      const { error: itemError } = await supabase
        .from("collection_items")
        .insert({
          user_id: userId,
          pin_id: pinId,
          owned_quantity: ownedCount,
          tradeable_quantity: tradeableCount,
          purchase_cost: purchaseCost,
          authenticity_status: "unknown",
        });

      if (itemError) {
        if (itemError.code === "23505") {
          throw new Error("This pin is already in your collection. You can edit its quantity in a later step.");
        }
        throw itemError;
      }

      onSaved();
    } catch (error) {
      setMessage(error.message || "Could not save this pin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pin-modal" role="dialog" aria-modal="true" aria-labelledby="add-pin-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose}><X size={20} /></button>
        <div className="eyebrow">GROW YOUR COLLECTION</div>
        <h2 id="add-pin-title">Add a pin</h2>

        <div className="filter-chips">
          <button type="button" className={`chip ${mode === "search" ? "active" : ""}`} onClick={() => { setMode("search"); setSelectedPin(null); setMessage(""); }}>Find existing</button>
          <button type="button" className={`chip ${mode === "create" ? "active" : ""}`} onClick={() => { setMode("create"); setSelectedPin(null); setMessage(""); }}>Create new</button>
        </div>

        {mode === "search" ? (
          <div>
            <label>Search catalog
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter a pin name..." />
            </label>
            <button className="button button-secondary button-wide" type="button" onClick={searchCatalog} disabled={busy || !query.trim()}>
              {busy ? "Searching..." : "Search pins"}
            </button>
            <div className="wishlist-list">
              {results.map((pin) => (
                <button type="button" key={pin.id} className="wishlist-item" onClick={() => setSelectedPin(pin)} style={{ width: "100%", textAlign: "left", cursor: "pointer", border: selectedPin?.id === pin.id ? "2px solid #e7c779" : undefined }}>
                  <div className="wishlist-item-main">
                    <strong>{pin.name}</strong>
                    <span>{[pin.character_name, pin.franchise, pin.park, pin.release_year].filter(Boolean).join(" · ")}</span>
                  </div>
                  {selectedPin?.id === pin.id && <CheckCircle2 size={18} />}
                </button>
              ))}
            </div>
            {selectedPin && <p>Selected: <strong>{selectedPin.name}</strong></p>}
          </div>
        ) : (
          <div className="add-pin-fields">
            <label>Pin name *
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Mickey Mouse castle pin" />
            </label>
            <label>Character
              <input value={character} onChange={(e) => setCharacter(e.target.value)} />
            </label>
            <label>Franchise or set
              <input value={franchise} onChange={(e) => setFranchise(e.target.value)} />
            </label>
            <label>Disney park
              <input value={park} onChange={(e) => setPark(e.target.value)} />
            </label>
            <label>Release year
              <input type="number" min="1900" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>

            <label>Pin photo
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (!file) {
                    setImageFile(null);
                    setImagePreview("");
                    return;
                  }

                  if (!file.type.startsWith("image/")) {
                    setMessage("Please select an image file.");
                    event.target.value = "";
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setMessage("The image must be 5 MB or smaller.");
                    event.target.value = "";
                    return;
                  }

                  setMessage("");
                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }}
              />
            </label>

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Pin preview"
                style={{
                  display: "block",
                  width: "160px",
                  height: "160px",
                  objectFit: "contain",
                  marginTop: "12px",
                  borderRadius: "12px",
                }}
              />
            )}

          </div>
        )}

        <form onSubmit={savePin}>
          <div className="add-pin-fields">
            <label>Quantity owned
              <input type="number" min="1" step="1" value={owned} onChange={(e) => setOwned(e.target.value)} required />
            </label>
            <label>Quantity tradeable
              <input type="number" min="0" step="1" value={tradeable} onChange={(e) => setTradeable(e.target.value)} required />
            </label>
            <label>Purchase cost (optional)
              <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </label>
          </div>

          {message && <p role="alert">{message}</p>}

          <button className="button button-gold button-wide" type="submit" disabled={busy || (mode === "search" && !selectedPin)}>
            {busy ? "Saving..." : "Save to my collection"}
          </button>
        </form>
      </div>
    </div>
  );
}


export function AddWishlistForm({ onClose, onSaved, session }) {
  const [catalogPins, setCatalogPins] = useState([]);
  const [loadingPins, setLoadingPins] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pinId, setPinId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadPins() {
      if (!supabase) {
        setError("Supabase isn't connected.");
        setLoadingPins(false);
        return;
      }

      const { data, error } = await supabase
        .from("pins")
        .select("id, name, character_name, franchise, park, image_url")
        .order("name", { ascending: true });

      if (ignore) return;

      if (error) {
        setError("Couldn't load the pin catalog. Please try again.");
        console.error("Wishlist catalog error:", error);
      } else {
        setCatalogPins(data || []);
      }

      setLoadingPins(false);
    }

    loadPins();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredPins = catalogPins.filter((pin) =>
    `${pin.name || ""} ${pin.character_name || ""} ${
      pin.franchise || ""
    } ${pin.park || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!session?.user?.id) {
      setError("Please sign in before adding a wishlist pin.");
      return;
    }

    if (!pinId) {
      setError("Please select a pin from the catalog.");
      return;
    }

    const price = targetPrice.trim() === "" ? null : Number(targetPrice);

    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0)
    ) {
      setError("Enter a valid target price of zero or more.");
      return;
    }

    setSaving(true);

    const { error: saveError } = await supabase
      .from("wishlist_items")
      .insert({
        user_id: session.user.id,
        pin_id: pinId,
        priority,
        target_price: price,
        notes: notes.trim() || null,
      });

    setSaving(false);

    if (saveError) {
      console.error("Could not save wishlist item:", saveError);
      setError(
        saveError.code === "23505"
          ? "This pin may already be on your wishlist."
          : "Couldn't save this pin. Please try again."
      );
      return;
    }

    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishlist-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">YOUR NEXT FINDS</span>
            <h2 id="wishlist-form-title">Add to Wishlist</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="wishlist-pin-search">Find a catalog pin</label>
          <input
            id="wishlist-pin-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by pin, character, or collection"
          />

          <label htmlFor="wishlist-pin-select">Select pin</label>
          <select
            id="wishlist-pin-select"
            value={pinId}
            onChange={(event) => setPinId(event.target.value)}
            required
            disabled={loadingPins}
          >
            <option value="">
              {loadingPins ? "Loading catalog..." : "Choose a pin"}
            </option>
            {filteredPins.map((pin) => (
              <option key={pin.id} value={pin.id}>
                {pin.name}
                {pin.character_name ? ` — ${pin.character_name}` : ""}
              </option>
            ))}
          </select>

          {!loadingPins && filteredPins.length === 0 && (
            <p>No matching pins found in the catalog.</p>
          )}

          <label htmlFor="wishlist-priority">Priority</label>
          <select
            id="wishlist-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="normal">Medium</option>
            <option value="high">High</option>
          </select>

          <label htmlFor="wishlist-target-price">
            Target price (optional)
          </label>
          <input
            id="wishlist-target-price"
            type="number"
            min="0"
            step="0.01"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            placeholder="e.g. 25.00"
          />

          <label htmlFor="wishlist-notes">Notes (optional)</label>
          <textarea
            id="wishlist-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Edition, color variant, or where you hope to find it..."
            rows={3}
          />

          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving || loadingPins}>
              {saving ? "Saving..." : "Add to Wishlist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export function EditWishlistForm({ item, session, onClose, onSaved, onRemove }) {
  const [priority, setPriority] = useState(
    item.priority?.toLowerCase() === "medium"
      ? "normal"
      : item.priority?.toLowerCase() || "normal"
  );
  const [targetPrice, setTargetPrice] = useState(
    item.targetPrice ?? ""
  );
  const [notes, setNotes] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!session?.user?.id || !supabase) {
      setError("Please sign in to edit your wishlist.");
      return;
    }

    const price =
      String(targetPrice).trim() === "" ? null : Number(targetPrice);

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setError("Enter a valid target price of zero or more.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("wishlist_items")
      .update({
        priority,
        target_price: price,
        notes: notes.trim() || null,
      })
      .eq("id", item.id)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (updateError) {
      console.error("Could not update wishlist item:", updateError);
      setError("Couldn't update this pin. Please try again.");
      return;
    }

    onSaved();
  }

  async function handleRemove() {
    if (!session?.user?.id || !supabase) {
      setError("Please sign in to remove this wishlist pin.");
      return;
    }

    if (!window.confirm(`Remove "${item.name}" from your wishlist?`)) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (deleteError) {
      console.error("Could not remove wishlist item:", deleteError);
      setError("Couldn't remove this pin. Please try again.");
      return;
    }

    onRemove();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-wishlist-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">YOUR NEXT FINDS</span>
            <h2 id="edit-wishlist-title">Edit Wishlist Pin</h2>
            <p>{item.name}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="edit-wishlist-priority">Priority</label>
          <select
            id="edit-wishlist-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="normal">Medium</option>
            <option value="high">High</option>
          </select>

          <label htmlFor="edit-wishlist-price">Target price (optional)</label>
          <input
            id="edit-wishlist-price"
            type="number"
            min="0"
            step="0.01"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            placeholder="e.g. 25.00"
          />

          <label htmlFor="edit-wishlist-notes">Notes (optional)</label>
          <textarea
            id="edit-wishlist-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add notes about this pin..."
          />

          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
            >
              Remove pin
            </button>
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export function EditCollectionForm({ pin, session, onClose, onSaved }) {
  const [owned, setOwned] = useState(String(pin.owned ?? 1));
  const [tradeable, setTradeable] = useState(
    String(pin.tradeable ?? 0)
  );
  const [purchaseCost, setPurchaseCost] = useState(
    pin.purchaseCost ?? ""
  );
  const [authenticityStatus, setAuthenticityStatus] = useState(
    pin.authenticityStatus || "unknown"
  );
  const [visibility, setVisibility] = useState(pin.visibility || "private");
  const [notes, setNotes] = useState(pin.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");


  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!session?.user?.id || !supabase) {
      setError("Please sign in to edit your collection.");
      return;
    }

    const ownedCount = Number(owned);
    const tradeableCount = Number(tradeable);
    const cost =
      String(purchaseCost).trim() === ""
        ? null
        : Number(purchaseCost);

    if (
      !Number.isInteger(ownedCount) ||
      ownedCount < 0 ||
      !Number.isInteger(tradeableCount) ||
      tradeableCount < 0
    ) {
      setError("Quantities must be whole numbers of zero or more.");
      return;
    }

    if (tradeableCount > ownedCount) {
      setError("Tradeable quantity cannot exceed the quantity you own.");
      return;
    }

    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError("Purchase cost must be zero or more.");
      return;
    }

    
setSaving(true);

try {
  // Keep the existing personal photo unless a new one is uploaded.
  let personalPhotoUrl = pin.photoUrl || null;
  let personalPhotoPath = pin.photoPath || null;

  if (imageFile) {
    const fileExtension =
      imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath =
      `${session.user.id}/${crypto.randomUUID()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("pin-images")
      .upload(filePath, imageFile, {
        contentType: imageFile.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Save the storage path for private images.
    personalPhotoPath = filePath;
    personalPhotoUrl = null;
  }

  // Keep the rest of your existing save code below this point.

  const { error: updateError } = await supabase
    .from("collection_items")
    .update({
      owned_quantity: ownedCount,
      tradeable_quantity: tradeableCount,
      purchase_cost: cost,
      authenticity_status: authenticityStatus,
      visibility,
      photo_url: personalPhotoUrl,
      photo_path: personalPhotoPath,
      notes: notes.trim() || null,
    })
    .eq("id", pin.collectionItemId)
    .eq("user_id", session.user.id);

  if (updateError) throw updateError;

  onSaved();
} catch (error) {
  console.error("Could not save collection changes:", error);
  setError(error.message || "Could not save your changes.");
} finally {
  setSaving(false);
}
  }


  async function handleRemove() {
    if (!session?.user?.id || !supabase) {
      setError("Please sign in to edit your collection.");
      return;
    }

    if (!window.confirm(`Remove "${pin.name}" from your collection?`)) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("collection_items")
      .delete()
      .eq("id", pin.collectionItemId)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (deleteError) {
      console.error("Could not remove collection item:", deleteError);
      setError("Couldn't remove this pin. Please try again.");
      return;
    }

    onSaved();
  }


  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-collection-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">YOUR PERSONAL ARCHIVE</span>
            <h2 id="edit-collection-title">Edit Collection Pin</h2>
            <p>{pin.name}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="collection-owned">Quantity owned</label>
          <input
            id="collection-owned"
            type="number"
            min="0"
            step="1"
            required
            value={owned}
            onChange={(event) => setOwned(event.target.value)}
          />


          <label htmlFor="collection-tradeable">Quantity available to trade</label>
          <input
            id="collection-tradeable"
            type="number"
            min="0"
            step="1"
            required
            value={tradeable}
            onChange={(event) => setTradeable(event.target.value)}
          />

          <label htmlFor="collection-cost">Total purchase cost (optional)</label>
          <input
            id="collection-cost"
            type="number"
            min="0"
            step="0.01"
            value={purchaseCost}
            onChange={(event) => setPurchaseCost(event.target.value)}
            placeholder="e.g. 12.50"
          />

          <label htmlFor="collection-authenticity">Authenticity</label>
          
          <select
            id="collection-authenticity"
            value={authenticityStatus}
            onChange={(event) => setAuthenticityStatus(event.target.value)}
          >
            <option value="unknown">Unknown</option>
            <option value="suspected_counterfeit">
              Suspected counterfeit
            </option>
            <option value="confirmed_counterfeit">
              Confirmed counterfeit
            </option>
            <option value="verified_authentic">
              Verified authentic
            </option>
          </select>


          <label htmlFor="collection-visibility">Who can see this pin?</label>
          <select
            id="collection-visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <option value="private">Private — only me</option>
            <option value="friends">Friends — accepted friends</option>
            <option value="public">Public — signed-in users</option>
          </select>

          <label htmlFor="collection-notes">Notes (optional)</label>
          <textarea
            id="collection-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add condition, trade, or purchase notes..."
          />

          
          <label htmlFor="edit-pin-photo">Change pin photo (optional)</label>
          <input
            id="edit-pin-photo"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                setImageFile(null);
                setImagePreview("");
                return;
              }

              if (!file.type.startsWith("image/")) {
                setError("Please select an image file.");
                event.target.value = "";
                return;
              }

              if (file.size > 5 * 1024 * 1024) {
                setError("The image must be 5 MB or smaller.");
                event.target.value = "";
                return;
              }

              setError("");
              setImageFile(file);
              setImagePreview(URL.createObjectURL(file));
            }}
          />

          {imagePreview && (
            <img
              src={imagePreview}
              alt={`New photo for ${pin.name}`}
              style={{
                display: "block",
                width: "160px",
                height: "160px",
                objectFit: "contain",
                margin: "12px 0",
              }}
            />
          )}


          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">

          <button
            type="button"
            className="button button-secondary"
            onClick={handleRemove}
            disabled={saving}
          >
            {saving ? "Working..." : "Remove from Collection"}
          </button>

            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}





export function EditPinForm({ pin, onClose, onSaved, onRemove }) {
  const [owned, setOwned] = useState(String(pin.owned));
  const [tradeable, setTradeable] = useState(String(pin.tradeable));
  const [cost, setCost] = useState(
    pin.purchaseCost == null ? "" : String(pin.purchaseCost)
  );
  const [notes, setNotes] = useState(pin.notes || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveChanges(e) {
    e.preventDefault();
    setMessage("");

    const ownedCount = Number(owned);
    const tradeableCount = Number(tradeable);
    const purchaseCost = cost.trim() === "" ? null : Number(cost);

    if (!Number.isInteger(ownedCount) || ownedCount < 1) {
      setMessage("Quantity owned must be at least 1.");
      return;
    }

    if (
      !Number.isInteger(tradeableCount) ||
      tradeableCount < 0 ||
      tradeableCount > ownedCount
    ) {
      setMessage("Tradeable quantity must be between 0 and quantity owned.");
      return;
    }

    if (
      purchaseCost !== null &&
      (!Number.isFinite(purchaseCost) || purchaseCost < 0)
    ) {
      setMessage("Enter a valid purchase cost.");
      return;
    }

    if (!supabase || !pin.collectionItemId) {
      setMessage("Cannot update this pin right now.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from("collection_items")
        .update({
          owned_quantity: ownedCount,
          tradeable_quantity: tradeableCount,
          purchase_cost: purchaseCost,
          notes: notes.trim() || null,
        })
        .eq("id", pin.collectionItemId)
        .eq("user_id", (await supabase.auth.getUser()).data.user.id);

      if (error) throw error;

      onSaved();
    } catch (error) {
      setMessage(error.message || "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function removePin() {
    const confirmed = window.confirm(
      `Remove "${pin.name}" from your collection? This will not delete the catalog entry.`
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in again.");

      const { error } = await supabase
        .from("collection_items")
        .delete()
        .eq("id", pin.collectionItemId)
        .eq("user_id", userData.user.id);

      if (error) throw error;

      onRemove();
    } catch (error) {
      setMessage(error.message || "Could not remove this pin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="pin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-pin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close edit form"
        >
          <X size={20} />
        </button>

        <div className="eyebrow">MY COLLECTION</div>
        <h2 id="edit-pin-title">Edit pin</h2>
        <p>{pin.name}</p>

        <form onSubmit={saveChanges}>
          <div className="add-pin-fields">
            <label>
              Quantity owned
              <input
                type="number"
                min="1"
                step="1"
                value={owned}
                onChange={(e) => setOwned(e.target.value)}
                required
              />
            </label>

            <label>
              Quantity tradeable
              <input
                type="number"
                min="0"
                step="1"
                value={tradeable}
                onChange={(e) => setTradeable(e.target.value)}
                required
              />
            </label>

            <label>
              Purchase cost (optional)
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </label>

            <label>
              Personal notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condition, where you found it, or other details..."
                rows="4"
              />
            </label>
          </div>

          {message && <p role="alert">{message}</p>}

          <button
            className="button button-gold button-wide"
            type="submit"
            disabled={busy}
          >
            {busy ? "Saving..." : "Save changes"}
          </button>

          <button
            className="button button-secondary button-wide"
            type="button"
            disabled={busy}
            onClick={removePin}
          >
            {busy ? "Please wait..." : "Remove from collection"}
          </button>
        </form>
      </div>
    </div>
  );
}




export function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setMessage(
          data.session
            ? "Account created! You're signed in."
            : "Account created! Check your email for a confirmation link."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "#101a30",
      color: "#f8f2e5",
      fontFamily: "inherit"
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 400,
          boxSizing: "border-box",
          padding: 32,
          borderRadius: 20,
          background: "#1a2740",
          border: "1px solid #35415a"
        }}
      >
        <div style={{
          color: "#e7c779",
          fontSize: 14,
          letterSpacing: 3,
          marginBottom: 12
        }}>
          ✦ PINFOLIO
        </div>

        <h1 style={{ marginBottom: 8 }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>

        <p style={{ color: "#b8c0cf", lineHeight: 1.5 }}>
          {mode === "login"
            ? "Sign in to access your pin collection."
            : "Start organizing your collection and wishlist."}
        </p>

        <label style={{ display: "block", marginTop: 24 }}>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={authInputStyle}
          />
        </label>

        <label style={{ display: "block", marginTop: 16 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            style={authInputStyle}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 24,
            padding: 13,
            border: 0,
            borderRadius: 10,
            background: "#e7c779",
            color: "#172039",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer"
          }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        {message && (
          <p role="status" style={{
            marginTop: 16,
            color: "#f8f2e5",
            overflowWrap: "anywhere"
          }}>
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 10,
            border: "1px solid #53617a",
            borderRadius: 10,
            background: "transparent",
            color: "#f8f2e5",
            cursor: "pointer"
          }}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

export const authInputStyle = {
  display: "block",
  boxSizing: "border-box",
  width: "100%",
  marginTop: 8,
  padding: 12,
  border: "1px solid #53617a",
  borderRadius: 9,
  background: "#101a30",
  color: "#ffffff",
  fontSize: 16
};


