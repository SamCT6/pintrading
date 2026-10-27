import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, GalleryVerticalEnd, Repeat2, Heart, MoreHorizontal,
  Search, Bell, Plus, ChevronRight, ArrowUpRight, LockKeyhole,
  SlidersHorizontal, Sparkles, ShieldCheck, Menu, X, CircleHelp,
  Settings, Layers3, ChartNoAxesCombined, ImagePlus, EyeOff, Clock3,
  CheckCircle2, Handshake, ArrowRightLeft
} from "lucide-react";
import { supabase, isDemoMode } from "../lib/supabase";


export function PinArt({ pin, small = false }) {
  return (
    <div
      className={`pin-art ${pin.color || "navy"} ${small ? "pin-art-small" : ""}`}
      aria-label={`${pin.name} pin artwork`}
    >
      {pin.imageUrl ? (
        <img
          src={pin.imageUrl}
          alt={pin.name}
          className="pin-photo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      ) : (
        <div className="pin-art-ring">
          <span>{pin.symbol || "✦"}</span>
        </div>
      )}
    </div>
  );
}


export function SectionTitle({ eyebrow, title, subtitle, action, onAction }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <button className="button button-secondary desktop-action" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, note, tone = "" }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}


export function PinCard({ pin, onClick, onEdit }) {
  return (
    <article className="pin-card">
      <button
        className="pin-image-button"
        onClick={onClick}
        aria-label={`View ${pin.name}`}
      >
        <PinArt pin={pin} />
        {pin.visibility !== "public" && (
          <span className="privacy-dot" title={pin.visibility === "friends" ? "Shared with friends" : "Private"}>
            <LockKeyhole size={13} />
          </span>
        )}
      </button>

      <div className="pin-card-body">
        <div className="pin-card-title">{pin.name}</div>
        <div className="pin-card-subtitle">{pin.set}</div>

        <div className="pin-card-footer">
          <span className="quantity">Owned ×{pin.owned}</span>
          {pin.tradeable > 0 ? (
            <span className="tradeable-label">
              {pin.tradeable} tradeable
            </span>
          ) : (
            <span className="kept-label">Keeping</span>
          )}
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.();
          }}
        >
          Edit
        </button>
      </div>
    </article>
  );
}


export function Dashboard({ setPage, pins = [], wishlistItems = [], loading = false }) {
  const owned = pins.reduce((sum, pin) => sum + Number(pin.owned || 0), 0);
  const tradeable = pins.reduce((sum, pin) => sum + Number(pin.tradeable || 0), 0);
  const costTotal = pins.reduce((sum, pin) => sum + (Number(pin.purchaseCost) || 0), 0);
  const setCount = new Set(pins.map(pin => pin.set).filter(Boolean)).size;
  const matches = wishlistItems.filter(wish => pins.some(pin => pin.id === wish.pinId));
  return (
    <>
      {isDemoMode && <div className="demo-banner"><Sparkles size={15} /> Preview mode · configure Supabase to save your collection</div>}
      <div className="welcome-panel">
        <div className="welcome-copy">
          <div className="eyebrow light">YOUR COLLECTION, IN ONE PLACE</div>
          <h1>A little magic,<br /><em>well organized.</em></h1>
          <p>Keep track of your pins, find your next favorite, and make trading with friends easier.</p>
          <button className="button button-gold" onClick={() => setPage("Collection")}><Plus size={17} /> Explore collection</button>
        </div>
        <div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-star">✦</div><div className="hero-moon">☾</div><div className="hero-spark">✧</div></div>
      </div>
      <div className="stat-grid">
        <StatCard icon={GalleryVerticalEnd} label="Pins owned" value={loading ? "…" : owned} note={`${pins.length} unique designs`} tone="tone-blue" />
        <StatCard icon={ChartNoAxesCombined} label="Recorded cost" value={loading ? "…" : `$${costTotal.toFixed(2)}`} note="Based on costs you entered" tone="tone-gold" />
        <StatCard icon={Layers3} label="Collections / sets" value={loading ? "…" : setCount} note="Distinct catalog groups" tone="tone-purple" />
        <StatCard icon={Repeat2} label="Tradeable copies" value={loading ? "…" : tradeable} note="Marked available to trade" tone="tone-green" />
      </div>
      <div className="content-grid dashboard-grid">
        <section className="panel"><div className="panel-heading"><div><h2>Recently added</h2><p>Your latest collection finds</p></div><button className="text-link" onClick={() => setPage("Collection")}>View collection <ChevronRight size={15} /></button></div>
          {loading ? <p>Loading your collection…</p> : pins.length === 0 ? <div className="empty-state"><h3>Your collection starts here</h3><p>Add your first pin to begin tracking your collection.</p><button className="button button-secondary" onClick={() => setPage("Collection")}>Add a pin</button></div> : <div className="recent-list">{pins.slice(0,3).map(pin => <div className="recent-row" key={pin.collectionItemId || pin.id}><PinArt pin={pin} small /><div className="recent-copy"><strong>{pin.name}</strong><span>{pin.set}</span></div><span className="quantity">×{pin.owned}</span></div>)}</div>}
        </section>
        <section className="panel wishlist-panel"><div className="panel-heading"><div><h2>Wishlist</h2><p>Your next pin finds</p></div><Heart size={19} className="muted-icon" /></div>
          {loading ? <p>Loading wishlist…</p> : wishlistItems.length === 0 ? <p>Your wishlist is empty. Add pins you hope to find.</p> : wishlistItems.slice(0,4).map(item => <div className="match-row" key={item.id}><div className="match-check"><Heart size={15} /></div><div className="match-copy"><strong>{item.name}</strong><span>{item.priority || "Medium"} priority</span></div></div>)}
          <button className="button button-secondary button-wide" onClick={() => setPage("Wishlist")}>Open wishlist <ArrowUpRight size={16} /></button>
          {matches.length > 0 && <p className="subtle-count">{matches.length} wishlist item(s) also appear in your collection.</p>}
        </section>
      </div>
    </>
  );
}

export function Collection({
  search,
  setSearch,
  setSelectedPin,
  pins,
  loading,
  onAddPin,
  onEditPin,
}) {
  const [filter, setFilter] = useState("All pins");
  const filtered = useMemo(() => pins.filter(p => {
    const matchesSearch = `${p.name} ${p.character} ${p.set}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All pins" || (filter === "Tradeable" && p.tradeable > 0) || (filter === "Private" && p.visibility === "private") || (filter === "Friends" && p.visibility === "friends") || (filter === "Public" && p.visibility === "public");
    return matchesSearch && matchesFilter;
  }), [pins, search, filter]);
  return (
    <>
      <SectionTitle
        eyebrow="YOUR PERSONAL ARCHIVE"
        title="My Collection"
        subtitle="Every pin has a place. Keep your collection organized your way."
        action="+ Add pin"
        onAction={onAddPin}
/>
      <div className="toolbar">
        <div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pins, characters, sets..." /></div>
        <button className="button button-secondary filter-button"><SlidersHorizontal size={16} /> Filters</button>
      </div>
      <div className="filter-chips">{["All pins", "Tradeable", "Private", "Friends", "Public"].map(f => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}</div>
      {loading ? (
  <p>Loading your collection...</p>
      ) : filtered.length === 0 ? (
        <p>Your collection is empty. Add your first pin next!</p>
      ) : (
        <div className="pin-grid">
          {filtered.map(pin => (
          <PinCard
            key={pin.collectionItemId}
            pin={pin}
            onClick={() => setSelectedPin(pin)}
            onEdit={() => onEditPin(pin)}
          />
        ))}
        </div>
      )}
      <p className="demo-footnote"><LockKeyhole size={14} /> Sharing is controlled by each pin’s visibility setting and enforced by Supabase row-level security.</p>
    </>
  );
}


export function Traders() {
  const [username, setUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [traderPins, setTraderPins] = useState([]);
  const [myPins, setMyPins] = useState([]);
  const [incomingTrades, setIncomingTrades] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offerListing, setOfferListing] = useState(null);
  const [offerPinId, setOfferPinId] = useState("");
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [offerMessage, setOfferMessage] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);
  const [counterTradeId, setCounterTradeId] = useState(null);
  const [wishlistMatches, setWishlistMatches] = useState([]);
  const [notificationItems, setNotificationItems] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  async function loadTraderData() {
    if (!supabase || isDemoMode) {
      setLoading(false);
      setError("Connect Supabase and sign in to use real trader features.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error("Please sign in again.");
      setCurrentUserId(user.id);

      const [requestResult, ownPinsResult, tradeResult] = await Promise.all([
        supabase.from("friend_requests")
          .select("id,sender_id,receiver_id,status,created_at")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        supabase.from("collection_items")
          .select("id,pin_id,owned_quantity,tradeable_quantity,pin:pins(id,name,franchise,park,image_url)")
          .eq("user_id", user.id)
          .gt("tradeable_quantity", 0),
        supabase.from("trades")
          .select("id,proposer_id,recipient_id,status,message,created_at,updated_at,proposer_confirmed,recipient_confirmed,trade_items(id,owner_id,pin_id,quantity,item_type,pin:pins(name))")
          .or(`proposer_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
      ]);
      if (requestResult.error) throw requestResult.error;
      if (ownPinsResult.error) throw ownPinsResult.error;
      if (tradeResult.error) throw tradeResult.error;

      const requests = requestResult.data || [];
      setFriendRequests(requests);
      setMyPins((ownPinsResult.data || []).filter(row => row.pin).map(row => ({
        id: row.pin_id, collectionItemId: row.id, name: row.pin.name,
        set: row.pin.franchise || row.pin.park || "Uncategorized",
        owned: row.owned_quantity, tradeable: row.tradeable_quantity,
      })));
      setIncomingTrades(tradeResult.data || []);
      const [matchesResult, notificationsResult] = await Promise.all([
        supabase.rpc("get_friend_wishlist_matches"),
        supabase.from("notifications").select("id,kind,title,body,created_at,read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!matchesResult.error) setWishlistMatches(matchesResult.data || []);
      if (!notificationsResult.error) setNotificationItems(notificationsResult.data || []);

      const acceptedIds = [...new Set(requests.filter(r => r.status === "accepted")
        .map(r => r.sender_id === user.id ? r.receiver_id : r.sender_id))];
      if (acceptedIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles").select("id,username,display_name,avatar_url").in("id", acceptedIds);
        if (profileError) throw profileError;
        setFriends(profiles || []);
        const { data: listings, error: listingError } = await supabase.rpc("get_shared_trader_listings", { p_user_ids: acceptedIds });
        if (listingError) throw listingError;
        const byId = new Map((profiles || []).map(profile => [profile.id, profile]));
        const signedListings = await Promise.all((listings || []).map(async row => {
          let imageUrl = row.image_url || null;
          if (row.image_path) {
            const { data: signedData, error: signedError } = await supabase.storage.from("pin-images").createSignedUrl(row.image_path, 60 * 60);
            if (!signedError && signedData?.signedUrl) imageUrl = signedData.signedUrl;
          }
          return {
            id: row.collection_item_id, ownerId: row.owner_id, pinId: row.pin_id,
            quantity: row.tradeable_quantity, visibility: row.visibility,
            name: row.pin_name, character: row.character_name,
            set: row.franchise || row.park || "Uncategorized",
            imageUrl, releaseYear: row.release_year,
            owner: byId.get(row.owner_id) || { username: row.username, display_name: row.display_name },
          };
        }));
        setTraderPins(signedListings);
      } else {
        setFriends([]);
        setTraderPins([]);
      }
    } catch (loadError) {
      console.error("Could not load trader data:", loadError);
      setError(loadError.message || "Couldn't load trader information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTraderData(); }, []);

  async function searchTrader(event) {
    event.preventDefault();
    setFoundUser(null);
    setSearchMessage("");
    setNotice("");
    const normalized = username.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_.-]{2,30}$/.test(normalized)) {
      setSearchMessage("Enter a username between 2 and 30 characters (letters, numbers, ., _ or -).");
      return;
    }
    if (!supabase) return;
    setSearching(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("find-trading-user", {
        body: { username: normalized },
      });
      if (invokeError) {
        let detail = invokeError.message;
        try { const payload = await invokeError.context?.json(); if (payload?.error) detail = payload.error; } catch {}
        throw new Error(detail);
      }
      setFoundUser(data?.user || null);
      setSearchMessage(data?.message || (data?.user ? "Trader found." : "No matching trader found."));
    } catch (searchError) {
      setSearchMessage(searchError.message || "Username search failed.");
    } finally { setSearching(false); }
  }

  async function sendFriendRequest(profile) {
    if (!supabase || !currentUserId || !profile) return;
    setNotice(""); setSearchMessage("");
    const existing = friendRequests.find(r =>
      [r.sender_id, r.receiver_id].includes(profile.id) && r.status === "pending"
    );
    if (existing && existing.receiver_id === currentUserId) {
      setSearchMessage("This person has already sent you a request. Accept it in Friend requests below.");
      return;
    }
    if (existing) { setSearchMessage("You've already sent this person a request."); return; }
    if (friends.some(friend => friend.id === profile.id)) { setSearchMessage("You're already friends."); return; }
    const { error: insertError } = await supabase.from("friend_requests").insert({ sender_id: currentUserId, receiver_id: profile.id });
    if (insertError) {
      setSearchMessage(insertError.code === "23505" ? "A pending request or friendship already exists." : insertError.message);
      return;
    }
    setNotice(`Friend request sent to @${profile.username}.`);
    await loadTraderData();
  }

  async function respondToFriend(requestId, response) {
    setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("respond_to_friend_request", {
      p_request_id: requestId, p_response: response,
    });
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(response === "accepted" ? "Friend request accepted." : "Friend request declined.");
    await loadTraderData();
  }

  async function createOffer(event) {
    event.preventDefault();
    if (!offerListing || !offerPinId) return;
    setSavingOffer(true); setError(""); setNotice("");
    const rpcName = counterTradeId ? "counteroffer_trade" : "create_trade_proposal";
    const rpcArgs = counterTradeId ? {
      p_trade_id: counterTradeId,
      p_offer_pin_id: offerPinId,
      p_offer_quantity: Number(offerQuantity),
      p_request_pin_id: offerListing.pinId,
      p_request_quantity: Number(requestQuantity),
      p_message: offerMessage.trim() || "Counteroffer",
    } : {
      p_recipient_id: offerListing.ownerId,
      p_offer_pin_id: offerPinId,
      p_offer_quantity: Number(offerQuantity),
      p_request_pin_id: offerListing.pinId,
      p_request_quantity: Number(requestQuantity),
      p_message: offerMessage.trim() || null,
    };
    const { error: offerError } = await supabase.rpc(rpcName, rpcArgs);
    setSavingOffer(false);
    if (offerError) { setError(offerError.message); return; }
    setNotice(counterTradeId ? "Counteroffer sent. The previous proposal was closed and your new offer is awaiting a response." : "Trade proposal sent. The other trader must accept it before either person confirms completion.");
    setOfferListing(null); setCounterTradeId(null); setOfferPinId(""); setOfferMessage(""); setCounterTradeId(null);
    await loadTraderData();
  }

  async function respondToTrade(tradeId, response) {
    const { error: rpcError } = await supabase.rpc("respond_to_trade", { p_trade_id: tradeId, p_response: response });
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(response === "accepted" ? "Trade accepted. Pins transfer only after both traders confirm." : "Trade declined.");
    await loadTraderData();
  }

  async function confirmTrade(tradeId) {
    const { data, error: rpcError } = await supabase.rpc("confirm_trade_completion", { p_trade_id: tradeId });
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(data === "completed" ? "Trade completed and inventory transferred." : "Your confirmation is saved. Waiting for the other trader.");
    await loadTraderData();
  }

  const incomingRequests = friendRequests.filter(r => r.receiver_id === currentUserId && r.status === "pending");
  const outgoingRequests = friendRequests.filter(r => r.sender_id === currentUserId && r.status === "pending");

  return (
    <>
      <SectionTitle eyebrow="TRADE WITH YOUR CIRCLE" title="Friends' Traders" subtitle="Find collectors, choose what you share, and propose trades." />
      {error && <p className="inline-alert" role="alert">{error}</p>}
      {notice && <p className="inline-success" role="status">{notice}</p>}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading"><div><h2>Notifications</h2><p>Recent trade and friend activity.</p></div><button className="button button-secondary" onClick={async () => { setShowNotifications(v => !v); if (currentUserId && notificationItems.some(n => !n.read_at)) { const ids = notificationItems.filter(n => !n.read_at).map(n => n.id); await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids); setNotificationItems(items => items.map(n => ({...n, read_at: n.read_at || new Date().toISOString()}))); } }}>{showNotifications ? "Hide" : `View (${notificationItems.filter(n => !n.read_at).length} unread)`}</button></div>
        {showNotifications && (notificationItems.length ? <div className="recent-list">{notificationItems.map(n => <div className="recent-row" key={n.id}><div className="recent-copy"><strong>{n.title}</strong><span>{n.body}</span><span className="subtle-count">{new Date(n.created_at).toLocaleString()}</span></div></div>)}</div> : <p>No notifications yet.</p>)}
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading"><div><h2>Wishlist matches</h2><p>Friends currently have pins on your wishlist available to trade.</p></div><Heart size={19} /></div>
        {wishlistMatches.length === 0 ? <p className="subtle-count">No matches yet. Add pins to your wishlist and ask friends to share tradeable copies.</p> : <div className="recent-list">{wishlistMatches.map((match) => <div className="recent-row" key={`${match.owner_id}-${match.pin_id}`}><div className="recent-copy"><strong>{match.pin_name}</strong><span>{match.franchise || match.park || "Pin collection"} · {match.tradeable_quantity} tradeable</span><span className="subtle-count">@{match.username || match.display_name || "friend"} · {match.priority || "normal"} priority</span></div></div>)}</div>}
      </section>
      <section className="panel trader-search-panel">
        <div className="panel-heading"><div><h2>Find a trader</h2><p>Search by their unique Pinfolio username.</p></div><Search size={20} /></div>
        <form className="trader-search-form" onSubmit={searchTrader}>
          <label className="sr-only" htmlFor="trader-username">Username</label>
          <input id="trader-username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username (e.g. pinfan_24)" maxLength={30} />
          <button className="button button-gold" type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button>
        </form>
        {searchMessage && <p className="search-result-message" role="status">{searchMessage}</p>}
        {foundUser && <div className="found-trader"><div className="avatar">{(foundUser.display_name || foundUser.username || "P").slice(0,1).toUpperCase()}</div><div className="recent-copy"><strong>{foundUser.display_name || foundUser.username}</strong><span>@{foundUser.username}</span></div><button className="button button-secondary" onClick={() => sendFriendRequest(foundUser)}>Add friend</button></div>}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading"><div><h2>Friend requests</h2><p>Accept a request before sharing trader listings.</p></div><Handshake size={20} /></div>
        {loading ? <p>Loading requests…</p> : incomingRequests.length === 0 && outgoingRequests.length === 0 ? <p>No pending friend requests.</p> : <div className="recent-list">
          {incomingRequests.map(request => <FriendRequestRow key={request.id} request={request} currentUserId={currentUserId} onRespond={respondToFriend} />)}
          {outgoingRequests.map(request => <FriendRequestRow key={request.id} request={request} currentUserId={currentUserId} />)}
        </div>}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading"><div><h2>Your friends</h2><p>{friends.length} accepted {friends.length === 1 ? "connection" : "connections"}</p></div><ShieldCheck size={20} /></div>
        {loading ? <p>Loading friends…</p> : friends.length === 0 ? <p>Once someone accepts your friend request, their shared trader pins will appear here.</p> : <div className="friend-strip">{friends.map(friend => <div className="friend-chip" key={friend.id}><div className="avatar">{(friend.display_name || friend.username || "P").slice(0,1).toUpperCase()}</div><div><strong>{friend.display_name || friend.username}</strong><span>@{friend.username}</span></div></div>)}</div>}
      </section>

      <div className="trader-heading"><h2>Available to trade</h2><span className="subtle-count">Shared by your friends</span></div>
      {loading ? <p>Loading shared pins…</p> : traderPins.length === 0 ? <div className="empty-state"><h3>No shared pins yet</h3><p>Ask a friend to set one of their collection pins to “Friends” or “Public” visibility and mark at least one copy tradeable.</p></div> : <div className="pin-grid">{traderPins.map(listing => <article className="pin-card trader-card" key={listing.id}><div className="pin-image-button"><PinArt pin={{ name: listing.name, imageUrl: listing.imageUrl }} /><span className="trade-badge">Tradeable ×{listing.quantity}</span></div><div className="pin-card-body"><div className="pin-card-title">{listing.name}</div><div className="pin-card-subtitle">{listing.set}</div><div className="owner-row"><div className="avatar avatar-small">{(listing.owner?.display_name || listing.owner?.username || "P").slice(0,1).toUpperCase()}</div><span>@{listing.owner?.username || "trader"}</span></div><button className="button button-secondary button-wide" onClick={() => { setOfferListing(listing); setOfferPinId(myPins[0]?.id || ""); setOfferQuantity("1"); setRequestQuantity("1"); setOfferMessage(""); }}>Propose trade <ArrowRightLeft size={15} /></button></div></article>)}</div>}

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-heading"><div><h2>Trade history</h2><p>Active proposals and completed or declined trades.</p></div><ArrowRightLeft size={20} /></div>
        {loading ? <p>Loading trades…</p> : incomingTrades.length === 0 ? <p>No active trade proposals.</p> : <div className="recent-list">{incomingTrades.map(trade => <div className="recent-row trade-request-row" key={trade.id}><div className="recent-copy"><strong>{trade.proposer_id === currentUserId ? "Trade you proposed" : "Incoming trade"}</strong><span>{trade.message || "No message included."}</span><span className="subtle-count">{new Date(trade.created_at).toLocaleString()}</span><span className="subtle-count">{trade.status === "pending" ? (trade.recipient_id === currentUserId ? "Waiting for your response" : "Waiting for recipient") : `Your confirmation: ${(trade.proposer_id === currentUserId ? trade.proposer_confirmed : trade.recipient_confirmed) ? "confirmed" : "not yet confirmed"}`}</span>{(trade.trade_items || []).map(item => <span className="subtle-count" key={item.id}>{item.item_type === "offered" ? "Offered" : "Requested"}: {item.pin?.name || "Pin"} ×{item.quantity}</span>)}</div>{trade.status === "pending" && trade.recipient_id === currentUserId ? <><button className="button button-primary" onClick={() => respondToTrade(trade.id, "accepted")}>Accept</button><button className="button button-secondary" onClick={() => respondToTrade(trade.id, "declined")}>Decline</button><button className="button button-secondary" onClick={() => { const offered = (trade.trade_items || []).find(i => i.item_type === "offered"); if (!offered) return; setCounterTradeId(trade.id); setOfferListing({ ownerId: trade.proposer_id, pinId: offered.pin_id, name: offered.pin?.name || "their pin", quantity: offered.quantity, owner: { username: "trader" } }); setOfferPinId(myPins[0]?.id || ""); setOfferQuantity("1"); setRequestQuantity(String(offered.quantity)); setOfferMessage("Counteroffer"); }}>Counteroffer</button></> : trade.status === "accepted" ? <button className="button button-primary" disabled={trade.proposer_id === currentUserId ? trade.proposer_confirmed : trade.recipient_confirmed} onClick={() => confirmTrade(trade.id)}>{(trade.proposer_id === currentUserId ? trade.proposer_confirmed : trade.recipient_confirmed) ? "Confirmed" : "Confirm completion"}</button> : <span className="trade-status-label">{trade.status}</span>}</div>)}</div>}
      </section>

      {offerListing && <div className="modal-backdrop" onClick={() => { setOfferListing(null); setCounterTradeId(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="offer-trade-title" onClick={e => e.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">TRADE PROPOSAL</span><h2 id="offer-trade-title">{counterTradeId ? "Make a counteroffer" : "Offer a trade"}</h2><p>Requesting {offerListing.name} from @{offerListing.owner?.username || "your friend"}</p></div><button className="icon-button" type="button" onClick={() => { setOfferListing(null); setCounterTradeId(null); }} aria-label="Close">×</button></div><form onSubmit={createOffer}><label htmlFor="offer-pin-select">Your tradeable pin</label><select id="offer-pin-select" value={offerPinId} onChange={e => setOfferPinId(e.target.value)} required><option value="">Choose a pin to offer</option>{myPins.map(pin => <option key={pin.id} value={pin.id}>{pin.name} — {pin.tradeable} tradeable</option>)}</select>{myPins.length === 0 && <p>You need at least one tradeable pin in your collection.</p>}<label htmlFor="offer-quantity">Copies you offer</label><input id="offer-quantity" type="number" min="1" max={myPins.find(p => p.id === offerPinId)?.tradeable || 1} value={offerQuantity} onChange={e => setOfferQuantity(e.target.value)} required /><label htmlFor="request-quantity">Copies you want</label><input id="request-quantity" type="number" min="1" max={offerListing.quantity} value={requestQuantity} onChange={e => setRequestQuantity(e.target.value)} required /><label htmlFor="offer-message">Message (optional)</label><textarea id="offer-message" value={offerMessage} onChange={e => setOfferMessage(e.target.value)} rows={3} maxLength={500} placeholder="Add a note for your trading partner" /><div className="modal-actions"><button type="button" onClick={() => { setOfferListing(null); setCounterTradeId(null); }}>Cancel</button><button type="submit" disabled={savingOffer || !offerPinId || myPins.length === 0}>{savingOffer ? "Sending…" : counterTradeId ? "Send counteroffer" : "Send proposal"}</button></div></form></div></div>}
    </>
  );
}

function FriendRequestRow({ request, currentUserId, onRespond }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    const otherId = request.sender_id === currentUserId ? request.receiver_id : request.sender_id;
    let active = true;
    supabase?.from("profiles").select("username,display_name").eq("id", otherId).maybeSingle().then(({data}) => { if (active) setProfile(data); });
    return () => { active = false; };
  }, [request.id, currentUserId, request.sender_id, request.receiver_id]);
  const incoming = request.receiver_id === currentUserId;
  return <div className="recent-row"><div className="recent-copy"><strong>{profile?.display_name || profile?.username || "Pinfolio user"}</strong><span>@{profile?.username || "loading"} · {incoming ? "Sent you a request" : "Request sent"}</span></div>{incoming ? <><button className="button button-primary" onClick={() => onRespond(request.id,"accepted")}>Accept</button><button className="button button-secondary" onClick={() => onRespond(request.id,"declined")}>Decline</button></> : <span className="subtle-count">Pending</span>}</div>;
}


export function Wishlist({
        wishlistItems = [],
        loading = false,
        error = "",
        onAdd,
        onEdit,
        onRemove,
      }) {
        return (
    <>
      <SectionTitle
        eyebrow="YOUR NEXT FINDS"
        title="My Wishlist"
        subtitle="Keep track of the pins you're hoping to find."
        action="+ Add to wishlist"
        onAction={onAdd}
      />

      <div className="wishlist-summary">
        <div>
          <span className="eyebrow">PINS ON YOUR LIST</span>
          <strong>{wishlistItems.length}</strong>
        </div>
        <div>
          <span className="eyebrow">FRIEND MATCHES</span>
          <strong>0</strong>
        </div>
        <div>
          <span className="eyebrow">HIGH PRIORITY</span>
          <strong>
            {wishlistItems.filter(
              (item) => item.priority?.toLowerCase() === "high"
            ).length}
          </strong>
        </div>
      </div>

      {loading ? (
        <p>Loading your wishlist...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : wishlistItems.length === 0 ? (
        <div className="empty-state">
          <h3>Your wishlist is empty</h3>
          <p>Add pins you're hoping to find, and they'll appear here.</p>
        </div>
      ) : (
        <div className="wishlist-list">
          {wishlistItems.map((item) => (
            <div className="wishlist-item" key={item.id}>
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="pin-image"
                />
              ) : (
                <div className="pin-image pin-image-placeholder">
                  ✦
                </div>
              )}

              <div className="wishlist-item-main">
                <strong>{item.name}</strong>
                <span>{item.set || "Uncategorized"}</span>
                <span
                  className={`priority priority-${(
                    item.priority || "medium"
                  ).toLowerCase()}`}
                >
                  {item.priority || "Medium"} priority
                </span>

                {item.targetPrice != null && (
                  <span>Target price: ${Number(item.targetPrice).toFixed(2)}</span>
                )}

                {item.notes && <span>{item.notes}</span>}
                <div className="wishlist-item-actions">
                <button type="button" onClick={() => onEdit(item)}>
                  Edit
                </button>
                <button type="button" onClick={() => onRemove(item)}>
                  Remove
                </button>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}


export function MorePage({ setPage, session }) {
  const [profile, setProfile] = useState({ username: "", display_name: "", bio: "", is_collection_public: false });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [setStats, setSetStats] = useState([]);
  const [costTotal, setCostTotal] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadProfileAndReports() {
      if (!supabase || !session?.user?.id) { setProfileLoading(false); return; }
      const [profileResult, collectionResult, catalogResult] = await Promise.all([
        supabase.from("profiles").select("username,display_name,bio,is_collection_public").eq("id", session.user.id).maybeSingle(),
        supabase.from("collection_items").select("purchase_cost,pin:pins(franchise,park)").eq("user_id", session.user.id),
        supabase.from("pins").select("id,franchise,park"),
      ]);
      if (!active) return;
      if (profileResult.data) setProfile({ username: profileResult.data.username || "", display_name: profileResult.data.display_name || "", bio: profileResult.data.bio || "", is_collection_public: !!profileResult.data.is_collection_public });
      if (collectionResult.data) setCostTotal(collectionResult.data.reduce((sum,row) => sum + (Number(row.purchase_cost) || 0), 0));
      if (catalogResult.data && collectionResult.data) {
        const groups = new Map();
        for (const pin of catalogResult.data) { const name = pin.franchise || pin.park || "Uncategorized"; groups.set(name, (groups.get(name) || 0) + 1); }
        const ownedIds = new Set(collectionResult.data.map(row => row.pin).filter(Boolean).map(row => row.franchise || row.park || "Uncategorized"));
        setSetStats([...groups.entries()].map(([name,total]) => ({name,total,represented:ownedIds.has(name)})).sort((a,b) => a.name.localeCompare(b.name)));
      }
      setProfileLoading(false);
    }
    loadProfileAndReports();
    return () => { active = false; };
  }, [session?.user?.id]);

  async function saveProfile(event) {
    event.preventDefault(); setProfileMessage("");
    if (!supabase || !session?.user?.id) return;
    const username = profile.username.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_.-]{2,30}$/.test(username)) { setProfileMessage("Username must be 2–30 characters and use letters, numbers, periods, underscores, or hyphens."); return; }
    setProfileSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, username, display_name: profile.display_name.trim() || null, bio: profile.bio.trim() || null, is_collection_public: profile.is_collection_public }, { onConflict: "id" });
    setProfileSaving(false);
    setProfileMessage(error ? (error.code === "23505" ? "That username is already taken. Try another." : error.message) : "Profile saved.");
  }

  return <>
    <SectionTitle eyebrow="YOUR PINFOLIO" title="More" subtitle="Profile, collection insights, and privacy controls." />
    <section className="panel settings-panel"><div className="panel-heading"><div><h2>Trader profile</h2><p>Your username is how friends can find you.</p></div><Settings size={20} /></div>
      {profileLoading ? <p>Loading profile…</p> : <form onSubmit={saveProfile} className="settings-form">
        <label htmlFor="profile-username">Username</label><input id="profile-username" value={profile.username} onChange={e => setProfile({...profile,username:e.target.value})} minLength={2} maxLength={30} required placeholder="your_username" />
        <label htmlFor="profile-display-name">Display name</label><input id="profile-display-name" value={profile.display_name} onChange={e => setProfile({...profile,display_name:e.target.value})} maxLength={80} placeholder="How friends see your name" />
        <label htmlFor="profile-bio">Bio (optional)</label><textarea id="profile-bio" rows={3} value={profile.bio} onChange={e => setProfile({...profile,bio:e.target.value})} maxLength={300} placeholder="Favorite parks, pin themes, or trading interests" />
        <label className="setting-check"><input type="checkbox" checked={profile.is_collection_public} onChange={e => setProfile({...profile,is_collection_public:e.target.checked})} /> Allow my profile to be discoverable to signed-in Pinfolio users</label>
        <button className="button button-gold" type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</button>
        {profileMessage && <p role="status">{profileMessage}</p>}
      </form>}
    </section>
    <section className="panel" style={{marginTop:20}}><div className="panel-heading"><div><h2>Collection report</h2><p>Based on the information you've entered, not live market prices.</p></div><ChartNoAxesCombined size={20}/></div><div className="wishlist-summary"><div><span className="eyebrow">RECORDED PURCHASE COST</span><strong>${costTotal.toFixed(2)}</strong></div><div><span className="eyebrow">CATALOG GROUPS</span><strong>{setStats.length}</strong></div><div><span className="eyebrow">GROUPS YOU OWN</span><strong>{setStats.filter(group=>group.represented).length}</strong></div></div><p className="subtle-count">Pinfolio does not currently fetch verified resale prices, so this report is not a market valuation.</p></section>
    <section className="panel" style={{marginTop:20}}><div className="panel-heading"><div><h2>Set overview</h2><p>Groups are based on franchise or park values in your catalog.</p></div><Layers3 size={20}/></div>{setStats.length === 0 ? <p>Add catalog pins with a franchise or park to start an overview.</p> : <div className="recent-list">{setStats.map(group=><div className="recent-row" key={group.name}><div className="recent-copy"><strong>{group.name}</strong><span>{group.represented ? "You own pins in this group" : "No pins owned yet"}</span></div><span className="subtle-count">{group.total} catalog {group.total===1?"pin":"pins"}</span></div>)}</div>}</section>
    <section className="panel" style={{marginTop:20}}><div className="panel-heading"><div><h2>Authenticity notes</h2><p>Record your assessment on each collection pin.</p></div><ShieldCheck size={20}/></div><p>Open Collection → Edit on any pin to record its authenticity status, notes, and photo. These are personal records, not an official authentication service.</p><button className="button button-secondary" onClick={() => setPage("Collection")}>Manage collection</button></section>
    <div className="security-card" style={{marginTop:20}}><LockKeyhole size={20}/><div><strong>Privacy controls</strong><p>Collection items default to private. Set individual pins to friends or public in their edit form. Supabase policies enforce access on the server.</p></div></div>
  </>;
}

