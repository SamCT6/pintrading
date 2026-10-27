import { useEffect, useState } from "react";
import {
  LayoutDashboard, GalleryVerticalEnd, Repeat2, Heart, MoreHorizontal,
  Search, Bell, Plus, ChevronRight, ArrowUpRight, LockKeyhole,
  SlidersHorizontal, Sparkles, ShieldCheck, Menu, X, CircleHelp,
  Settings, Layers3, ChartNoAxesCombined, ImagePlus, EyeOff, Clock3,
  CheckCircle2, Handshake, ArrowRightLeft, LogOut
} from "lucide-react";
import { supabase, isDemoMode } from "./lib/supabase";
import { Dashboard, Collection, Traders, Wishlist, MorePage } from "./components/AppViews.jsx";
import Catalog from "./components/Catalog.jsx";
import { PinDetail, AddPinForm, AddWishlistForm, EditWishlistForm, EditCollectionForm, AuthScreen } from "./forms/PinForms.jsx";

const navItems = [
  { id: "Dashboard", icon: LayoutDashboard },
  { id: "Collection", icon: GalleryVerticalEnd },
  { id: "Catalog", icon: Layers3 },
  { id: "Traders", icon: Repeat2 },
  { id: "Wishlist", icon: Heart },
  { id: "More", icon: MoreHorizontal }
];

export default function App() {

const [session, setSession] = useState(null);
const [authReady, setAuthReady] = useState(false);
const [tradeProposalCount, setTradeProposalCount] = useState(0);

const [page, setPage] = useState("Dashboard");
const [search, setSearch] = useState("");
const [selectedPin, setSelectedPin] = useState(null);
const [collectionPins, setCollectionPins] = useState([]);
const [collectionLoading, setCollectionLoading] = useState(true);
const [editingCollectionPin, setEditingCollectionPin] = useState(null);
const [wishlistItems, setWishlistItems] = useState([]);
const [wishlistLoading, setWishlistLoading] = useState(false);
const [wishlistError, setWishlistError] = useState("");
const [showWishlistAdd, setShowWishlistAdd] = useState(false);
const [editingWishlistItem, setEditingWishlistItem] = useState(null);
const [wishlistRefresh, setWishlistRefresh] = useState(0);
const [collectionRefresh, setCollectionRefresh] = useState(0);
const [showAddPin, setShowAddPin] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [editingPin, setEditingPin] = useState(null);

const userEmail = session?.user?.email ?? "Account";

// Keep the Traders badge tied to proposals that are still awaiting a response.
useEffect(() => {
  const userId = session?.user?.id;
  if (!supabase || !userId) {
    setTradeProposalCount(0);
    return;
  }

  let ignore = false;
  const loadTradeProposalCount = async () => {
    const { count, error } = await supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or(`proposer_id.eq.${userId},recipient_id.eq.${userId}`);

    if (ignore) return;
    if (error) {
      console.error("Could not load trade proposal count:", error.message);
      return;
    }
    setTradeProposalCount(count || 0);
  };

  loadTradeProposalCount();
  // Poll as a fallback in case Realtime is not enabled for the trades table.
  const refreshInterval = window.setInterval(loadTradeProposalCount, 30000);
  const channel = supabase
    .channel(`trade-proposal-count-${userId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "trades", filter: `proposer_id=eq.${userId}`,
    }, loadTradeProposalCount)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "trades", filter: `recipient_id=eq.${userId}`,
    }, loadTradeProposalCount)
    .subscribe();

  return () => {
    ignore = true;
    window.clearInterval(refreshInterval);
    supabase.removeChannel(channel);
  };
}, [session]);


  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

  

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Could not load session:", error.message);
      }

      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


useEffect(() => {
  let ignore = false;

  async function loadWishlist() {
    if (!session?.user || !supabase) {
      setWishlistItems([]);
      setWishlistLoading(false);
      setWishlistError("");
      return;
    }

    setWishlistLoading(true);
    setWishlistError("");

    const { data, error } = await supabase
      .from("wishlist_items")
      .select(`
        id,
        priority,
        target_price,
        notes,
        pin:pins (
          id,
          name,
          description,
          character_name,
          franchise,
          park,
          image_url,
          image_path
        )
      `)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (ignore) return;

    if (error) {
      console.error("Error loading wishlist:", error);
      setWishlistError("Couldn't load your wishlist. Please try again.");
      setWishlistItems([]);
    } else {
      const items = (data || [])
        .filter((item) => item.pin)
        .map((item) => ({
          id: item.id,
          pinId: item.pin.id,
          name: item.pin.name,
          set: item.pin.franchise || item.pin.park || "Uncategorized",
          character: item.pin.character_name || "Unknown character",
          imageUrl: item.photo_url || item.pin.image_url,
        photoUrl: item.photo_url,
          priority: item.priority,
          targetPrice: item.target_price,
          notes: item.notes,
        }));

      setWishlistItems(items);
    }

    setWishlistLoading(false);
  }

  loadWishlist();

  return () => {
    ignore = true;
  };
}, [session, wishlistRefresh]);


  


useEffect(() => {
  async function loadCollection() {
    if (!supabase || !session?.user?.id) {
      setCollectionPins([]);
      setCollectionLoading(false);
      return;
    }

    setCollectionLoading(true);

    const { data, error } = await supabase
      .from("collection_items")
      .select(`
        id,
        owned_quantity,
        tradeable_quantity,
        purchase_cost,
        authenticity_status,
        notes,
        visibility,
        photo_url,
        photo_path,
        pin:pins (
          id,
          name,
          description,
          character_name,
          franchise,
          park,
          release_year,
          edition_type,
          image_url,
          image_path
        )
      `)
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Could not load collection:", error.message);
      setCollectionLoading(false);
      return;
    }

    const pins = await Promise.all((data ?? []).filter((item) => item.pin).map(async (item) => {
      const photoPath = item.photo_path || item.pin.image_path || null;
      let signedImageUrl = item.photo_url || item.pin.image_url || null;
      if (photoPath) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("pin-images").createSignedUrl(photoPath, 60 * 60);
        if (!signedError && signedData?.signedUrl) signedImageUrl = signedData.signedUrl;
      }
      return {
        id: item.pin.id,
        collectionItemId: item.id,
        name: item.pin.name,
        set: item.pin.franchise || item.pin.park || "Uncategorized",
        character: item.pin.character_name || "Unknown character",
        owned: item.owned_quantity,
        tradeable: item.tradeable_quantity,
        visibility: item.visibility || "private",
        color: "navy",
        symbol: "✦",
        purchaseCost: item.purchase_cost,
        authenticityStatus: item.authenticity_status,
        notes: item.notes,
        imageUrl: signedImageUrl,
        photoUrl: item.photo_url,
        photoPath: item.photo_path,
      };
    }));

    setCollectionPins(pins);
    setCollectionLoading(false);
  }

  loadCollection();
}, [session, collectionRefresh]);


  async function handleLogout() {
    if (!supabase) {
      setSession(null);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("Could not log out:", error.message);
        window.alert(`Could not log out: ${error.message}`);
        return;
      }
      setSession(null);
      setMobileMenuOpen(false);
      setPage("Dashboard");
    } catch (error) {
      console.error("Could not log out:", error);
      window.alert("Could not log out. Please check your connection and try again.");
    }
  }


  const navigate = (id) => { setPage(id); setMobileMenuOpen(false); };
  const currentIcon = navItems.find(n => n.id === page)?.icon || MoreHorizontal;
  if (!authReady) {
    return <p style={{ padding: 24 }}>Loading Pinfolio...</p>;
  }
  
  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark">✦</div><div><span>Pinfolio</span><small>YOUR PIN COLLECTION</small></div><button className="mobile-close" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav">{navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? "selected" : ""}`} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.id}</span>{item.id === "Traders" && <span className="nav-count">{tradeProposalCount}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-tip"><Sparkles size={17} /><strong>A little pin magic</strong><p>Your next favorite might be in a friend's trader list.</p><button onClick={() => navigate("Traders")}>Find a match <ArrowUpRight size={14} /></button></div><div className="profile-row"><div className="avatar profile-avatar">{userEmail.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>My account</strong><span>{userEmail}</span></div><MoreHorizontal size={18} className="muted-icon" /></div><button className="nav-item logout-nav-item" onClick={handleLogout}><LogOut size={19} /><span>Log Out</span></button></div>
      </aside>
      {mobileMenuOpen && <button className="mobile-scrim" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" />}
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><div className="breadcrumb"><span>Pinfolio</span><ChevronRight size={15} /><strong>{page}</strong></div><div className="topbar-actions"><span className="sync-status"><span className="status-dot"></span>{isDemoMode ? "Preview mode" : "Connected"}</span><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /></button><div
  className="avatar top-avatar"
  title={userEmail}
  aria-label={`Signed in as ${userEmail}`}
>
  {userEmail.slice(0, 1).toUpperCase()}
</div></div></header>
        <div className="page-content">
        {page === "Dashboard" && <Dashboard setPage={navigate} pins={collectionPins} wishlistItems={wishlistItems} loading={collectionLoading || wishlistLoading} />}
        {page === "Collection" && (
          <Collection
          search={search}
          setSearch={setSearch}
          setSelectedPin={setSelectedPin}
          pins={collectionPins}
          loading={collectionLoading}
          onAddPin={() => setShowAddPin(true)}
          onEditPin={(pin) => setEditingCollectionPin(pin)}
        />
        )}
        {page === "Traders" && <Traders />}
        {page === "Catalog" && <Catalog userId={session?.user?.id} />}
        
        {page === "Wishlist" && (
          <Wishlist
            wishlistItems={wishlistItems}
            loading={wishlistLoading}
            error={wishlistError}
            onAdd={() => setShowWishlistAdd(true)}
            onEdit={(item) => setEditingWishlistItem(item)}
            onRemove={async (item) => {
              if (!session?.user?.id || !supabase) return;

              if (!window.confirm(`Remove "${item.name}" from your wishlist?`)) {
                return;
              }

              const { error } = await supabase
                .from("wishlist_items")
                .delete()
                .eq("id", item.id)
                .eq("user_id", session.user.id);

              if (error) {
                console.error("Could not remove wishlist item:", error);
                window.alert("Couldn't remove this pin. Please try again.");
                return;
              }

              setWishlistRefresh((value) => value + 1);
            }}
          />
        )}

        {page === "More" && <MorePage setPage={navigate} session={session} />}
        <footer className="footer"><span>Pinfolio · Personal pin collection tracker</span><span><LockKeyhole size={13} /> Private by default</span></footer>
      </div>
        <nav className="mobile-bottom-nav">{navItems.map(item => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={20} /><span>{item.id}</span>{item.id === "Traders" && tradeProposalCount > 0 && <span className="nav-count mobile-nav-count">{tradeProposalCount}</span>}</button>)}</nav>
      </main>
      <PinDetail
        pin={selectedPin}
        onClose={() => setSelectedPin(null)}
        onEdit={(pin) => {
          setEditingCollectionPin(pin);
          setSelectedPin(null);
        }}
        onRemove={(pin) => {
          setEditingCollectionPin(pin);
          setSelectedPin(null);
        }}
      />
      {showAddPin && (
      <AddPinForm
        userId={session.user.id}
        onClose={() => setShowAddPin(false)}
        onSaved={() => {
          setShowAddPin(false);
          setCollectionRefresh((value) => value + 1);
        }}
      />
      )}

      {showWishlistAdd && (
        <AddWishlistForm
          session={session}
          onClose={() => setShowWishlistAdd(false)}
          onSaved={() => {
            setShowWishlistAdd(false);
            setWishlistRefresh((value) => value + 1);
          }}
        />
      )}



      {editingWishlistItem && (
        <EditWishlistForm
          item={editingWishlistItem}
          session={session}
          onClose={() => setEditingWishlistItem(null)}
          onSaved={() => {
            setEditingWishlistItem(null);
            setWishlistRefresh((value) => value + 1);
          }}
          onRemove={() => {
            setEditingWishlistItem(null);
            setWishlistRefresh((value) => value + 1);
          }}
        />
      )}


      {editingCollectionPin && (
        <EditCollectionForm
          pin={editingCollectionPin}
          session={session}
          onClose={() => setEditingCollectionPin(null)}
          onSaved={() => {
            setEditingCollectionPin(null);
            setCollectionRefresh((value) => value + 1);
          }}
        />
      )}


      



    </div>
  );
}
