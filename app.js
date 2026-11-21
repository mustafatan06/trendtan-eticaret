// ==========================================
// TRENDTAN E-TİCARET PLATFORMU - FIREBASE FIRESTORE SÜRÜMÜ
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAcpnR75lrd5j2CP9Vf5Fr6u60uhGfcNWs",
    authDomain: "trendtan.firebaseapp.com",
    projectId: "trendtan",
    storageBucket: "trendtan.firebasestorage.app",
    messagingSenderId: "125062583570",
    appId: "1:125062583570:web:7ad48314a7f6864fbecfcb",
    measurementId: "G-QP720WXC7P"
};

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp);
const storeDocRef = doc(firestoreDb, "trendtan_store", "main_state");

const DEFAULT_DB = {
    adminPassword: 'trendtan2026',
    posConfig: { provider: 'paytr', apiKey: '', secretKey: '', merchantSalt: '' },
    sellers: [],
    sellerApplications: [],
    customers: [],
    products: [],
    coupons: [
        { code: 'TREND10', type: 'percent', value: 10 },
        { code: 'HOSGELDIN50', type: 'fixed', value: 50 }
    ],
    orders: []
};

let db = structuredClone(DEFAULT_DB);
let isSaving = false;

// Uygulama Durumu
let cart = [];
let appliedCoupon = null;
let currentCategory = 'all';
let currentSearch = '';
let currentSeller = null;
let uploadedImageUrl = '';

const $ = (id) => document.getElementById(id);
const formatMoney = (val) => Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

function showToast(msg) {
    const toast = $('toastNotification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function refreshAllViews() {
    if (currentSeller) {
        const updatedSeller = db.sellers.find(s => s.id === currentSeller.id);
        if (updatedSeller) currentSeller = updatedSeller;
    }
    renderProducts();
    updateCartUI();
    if (currentSeller) renderSellerDashboard();
    if (!$('superAdminDashboardView').classList.contains('hidden')) renderAdminDashboard();
}

// Firestore'dan Verileri Çek ve Canlı Dinle
async function initFirestoreSync() {
    try {
        const snap = await getDoc(storeDocRef);
        if (snap.exists()) {
            db = { ...structuredClone(DEFAULT_DB), ...snap.data() };
        } else {
            await setDoc(storeDocRef, DEFAULT_DB);
            db = structuredClone(DEFAULT_DB);
        }
        refreshAllViews();

        onSnapshot(storeDocRef, (docSnap) => {
            if (isSaving || !docSnap.exists()) return;
            db = { ...structuredClone(DEFAULT_DB), ...docSnap.data() };
            refreshAllViews();
        }, (err) => {
            console.error('Firestore dinleme hatası:', err);
        });
    } catch (err) {
        console.error('Firestore bağlantı hatası:', err);
        showToast('Veritabanı bağlantısı kurulamadı. Firestore kurallarını kontrol edin.');
    }
}

async function loadDB() {
    try {
        const snap = await getDoc(storeDocRef);
        if (snap.exists()) {
            db = { ...structuredClone(DEFAULT_DB), ...snap.data() };
            refreshAllViews();
        }
    } catch (err) {
        showToast('Veriler güncellenirken hata oluştu.');
    }
}

// Tüm Değişiklikleri Firestore'a Kalıcı Kaydet
async function saveDB() {
    isSaving = true;
    try {
        await setDoc(storeDocRef, db);
    } catch (err) {
        console.error('Firestore kayıt hatası:', err);
        showToast('Veriler veritabanına kaydedilirken hata oluştu (görsel boyutu büyük olabilir).');
    } finally {
        setTimeout(() => { isSaving = false; }, 300);
    }
}

// PC veya Mobilden Seçilen Görseli Küçültüp Base64 Yap (Firestore 1MB sınırına uygun)
function compressImageToBase64(file, maxWidth = 700, quality = 0.72) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==========================================
// 1. MÜŞTERİ MAĞAZASI & ÜRÜN LİSTELEME
// ==========================================
function renderProducts() {
    const grid = $('productGrid');
    const onlyFreeShipping = $('freeShippingFilter').checked;
    const sortBy = $('sortSelect').value;

    let filtered = db.products.filter(p => {
        const seller = db.sellers.find(s => s.id === p.sellerId);
        if (!seller || !seller.active) return false;

        const matchCat = currentCategory === 'all' || p.category === currentCategory;
        const matchSearch = p.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
                            p.sellerName.toLowerCase().includes(currentSearch.toLowerCase()) ||
                            p.category.toLowerCase().includes(currentSearch.toLowerCase());
        const matchShip = !onlyFreeShipping || Number(p.shipping) === 0;
        return matchCat && matchSearch && matchShip;
    });

    if (sortBy === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    if (sortBy === 'discount') {
        filtered.sort((a, b) => ((b.oldPrice - b.price) / b.oldPrice) - ((a.oldPrice - a.price) / a.oldPrice));
    }

    $('productCountText').textContent = `(${filtered.length} ürün)`;
    $('currentCategoryTitle').textContent = currentCategory === 'all' ? 'Tüm Ürünler' : currentCategory;

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:45px; color:#64748b;">Henüz yayında ürün bulunmuyor veya seçilen filtreye uygun ürün yok.</p>`;
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const discountRate = prod.oldPrice > prod.price ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100) : 0;
        return `
            <div class="product-card">
                ${discountRate > 0 ? `<span class="discount-tag">%${discountRate} İndirim</span>` : ''}
                ${Number(prod.shipping) === 0 ? `<span class="shipping-tag">Ücretsiz Kargo</span>` : ''}
                <img src="${prod.image}" alt="${prod.name}" class="product-img">
                <div class="product-body">
                    <span class="seller-chip"><i class="fa-solid fa-store"></i> ${prod.sellerName}</span>
                    <h3 class="product-title">${prod.name}</h3>
                    <p class="product-desc">${prod.desc || ''}</p>
                    <div class="price-block">
                        ${prod.oldPrice > prod.price ? `<span class="old-price">${formatMoney(prod.oldPrice)}</span>` : ''}
                        <span class="current-price">${formatMoney(prod.price)}</span>
                        <span class="shipping-info-text">${Number(prod.shipping) === 0 ? 'Kargo Bedava' : 'Kargo: ' + formatMoney(prod.shipping)}</span>
                    </div>
                    <button class="btn-add-cart" onclick="addToCart('${prod.id}')">
                        <i class="fa-solid fa-cart-plus"></i> Sepete Ekle
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        renderProducts();
    });
});

$('searchInput').addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderProducts();
});
$('freeShippingFilter').addEventListener('change', renderProducts);
$('sortSelect').addEventListener('change', renderProducts);

// ==========================================
// 2. SEPET SİSTEMİ (+ / - ADET & KUPON)
// ==========================================
window.addToCart = function(productId) {
    const product = db.products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.product.id === productId);
    if (existing) {
        if (existing.qty < product.stock) {
            existing.qty++;
        } else {
            showToast('Stok adedine ulaştınız!');
            return;
        }
    } else {
        if (product.stock <= 0) {
            showToast('Bu ürün stokta kalmadı.');
            return;
        }
        cart.push({ product, qty: 1 });
    }
    updateCartUI();
    showToast('Ürün sepete eklendi.');
};

window.changeCartQty = function(productId, delta) {
    const idx = cart.findIndex(item => item.product.id === productId);
    if (idx === -1) return;

    const newQty = cart[idx].qty + delta;
    if (newQty <= 0) {
        cart.splice(idx, 1);
    } else if (newQty <= cart[idx].product.stock) {
        cart[idx].qty = newQty;
    } else {
        showToast('Stok sınırı aşılamaz.');
    }
    updateCartUI();
};

function calculateCartTotals() {
    let subtotal = 0;
    let shippingTotal = 0;
    let totalCount = 0;

    cart.forEach(item => {
        subtotal += item.product.price * item.qty;
        shippingTotal += Number(item.product.shipping);
        totalCount += item.qty;
    });

    let discount = 0;
    if (appliedCoupon && subtotal > 0) {
        if (appliedCoupon.type === 'percent') {
            discount = (subtotal * appliedCoupon.value) / 100;
        } else {
            discount = Math.min(subtotal, appliedCoupon.value);
        }
    }

    const grandTotal = Math.max(0, subtotal + shippingTotal - discount);
    return { subtotal, shippingTotal, discount, grandTotal, totalCount };
}

function updateCartUI() {
    const { subtotal, shippingTotal, discount, grandTotal, totalCount } = calculateCartTotals();
    $('cartBadge').textContent = totalCount;

    const container = $('cartItemsContainer');
    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#64748b; margin-top:40px;">Sepetiniz boş.</p>`;
    } else {
        container.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.product.image}" alt="${item.product.name}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.product.name}</div>
                    <div class="cart-item-price">${formatMoney(item.product.price * item.qty)}</div>
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="changeCartQty('${item.product.id}', -1)">-</button>
                        <span><strong>${item.qty}</strong></span>
                        <button class="qty-btn" onclick="changeCartQty('${item.product.id}', 1)">+</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    $('cartSubtotal').textContent = formatMoney(subtotal);
    $('cartShippingTotal').textContent = formatMoney(shippingTotal);

    if (discount > 0) {
        $('cartDiscountRow').classList.remove('hidden');
        $('cartDiscountAmount').textContent = '-' + formatMoney(discount);
    } else {
        $('cartDiscountRow').classList.add('hidden');
    }

    $('cartGrandTotal').textContent = formatMoney(grandTotal);
}

$('applyCouponBtn').addEventListener('click', () => {
    const code = $('cartCouponInput').value.trim().toUpperCase();
    const found = db.coupons.find(c => c.code === code);
    const msgEl = $('couponMessage');

    if (!found) {
        appliedCoupon = null;
        msgEl.style.color = '#dc2626';
        msgEl.textContent = 'Geçersiz kupon kodu!';
    } else {
        appliedCoupon = found;
        msgEl.style.color = '#16a34a';
        msgEl.textContent = `"${found.code}" kuponu uygulandı.`;
    }
    updateCartUI();
});

$('openCartBtn').addEventListener('click', () => {
    $('cartDrawer').classList.add('open');
    $('cartOverlay').classList.remove('hidden');
});
function closeCart() {
    $('cartDrawer').classList.remove('open');
    $('cartOverlay').classList.add('hidden');
}
$('closeCartBtn').addEventListener('click', closeCart);
$('cartOverlay').addEventListener('click', closeCart);

// ==========================================
// 3. ÖDEME, SİPARİŞ & MÜŞTERİ KAYDI
// ==========================================
$('proceedCheckoutBtn').addEventListener('click', () => {
    if (cart.length === 0) {
        showToast('Sepetiniz boş.');
        return;
    }
    closeCart();
    const { grandTotal } = calculateCartTotals();
    $('modalFinalPrice').textContent = formatMoney(grandTotal);

    const posName = db.posConfig.provider === 'paytr' ? 'PayTR Sanal POS Altyapısı' :
                    db.posConfig.provider === 'iyzico' ? 'iyzico Sanal POS Altyapısı' :
                    'Kart Ödeme Altyapısı';
    $('activePosLabel').textContent = posName;

    $('checkoutModal').classList.remove('hidden');
});

document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value.includes('Kart')) {
            $('cardFieldsBox').classList.remove('hidden');
        } else {
            $('cardFieldsBox').classList.add('hidden');
        }
    });
});

$('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const custName = $('custName').value.trim();
    const custPhone = $('custPhone').value.trim();
    const custAddress = $('custAddress').value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const today = new Date().toLocaleDateString('tr-TR');
    const { grandTotal } = calculateCartTotals();

    let customer = db.customers.find(c => c.phone === custPhone || c.name.toLowerCase() === custName.toLowerCase());
    if (customer) {
        customer.name = custName;
        customer.phone = custPhone;
        customer.address = custAddress;
        customer.totalSpent = Number(customer.totalSpent) + grandTotal;
        customer.orderCount = Number(customer.orderCount) + 1;
        customer.lastOrderDate = today;
    } else {
        db.customers.unshift({
            id: 'cust_' + Date.now(),
            name: custName,
            phone: custPhone,
            address: custAddress,
            totalSpent: grandTotal,
            orderCount: 1,
            lastOrderDate: today
        });
    }

    const sellerGroups = {};
    cart.forEach(item => {
        const sId = item.product.sellerId;
        if (!sellerGroups[sId]) sellerGroups[sId] = [];
        sellerGroups[sId].push(item);
        const dbProd = db.products.find(p => p.id === item.product.id);
        if (dbProd) dbProd.stock = Math.max(0, dbProd.stock - item.qty);
    });

    Object.keys(sellerGroups).forEach(sId => {
        const groupItems = sellerGroups[sId];
        const groupTotal = groupItems.reduce((sum, i) => sum + (i.product.price * i.qty) + Number(i.product.shipping), 0);
        const itemsText = groupItems.map(i => `${i.product.name} (x${i.qty})`).join(', ');

        db.orders.unshift({
            id: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
            sellerId: sId,
            customerName: custName,
            customerPhone: custPhone,
            customerAddress: custAddress,
            itemsText,
            total: groupTotal,
            paymentMethod,
            status: 'pending',
            date: today
        });
    });

    await saveDB();
    cart = [];
    appliedCoupon = null;
    updateCartUI();
    renderProducts();
    $('checkoutModal').classList.add('hidden');
    $('checkoutForm').reset();
    showToast('Siparişiniz alındı ve merkeze iletildi.');
});

// ==========================================
// 4. KURUMSAL SATICI BAŞVURU & SATICI PANELİ
// ==========================================
function switchSellerAuthTab(targetTabId) {
    document.querySelectorAll('#sellerAuthModal .m-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mtab === targetTabId);
    });

    const loginForm = $('sellerLoginForm');
    const applyForm = $('sellerApplyForm');

    if (targetTabId === 'sellerApplyTab') {
        loginForm.classList.add('hidden');
        loginForm.classList.remove('active');
        applyForm.classList.remove('hidden');
        applyForm.classList.add('active');
    } else {
        applyForm.classList.add('hidden');
        applyForm.classList.remove('active');
        loginForm.classList.remove('hidden');
        loginForm.classList.add('active');
    }
}

$('openSellerModalBtn').addEventListener('click', () => {
    if (currentSeller) {
        switchMainView('sellerDashboardView');
        renderSellerDashboard();
    } else {
        $('sellerAuthModal').classList.remove('hidden');
        switchSellerAuthTab('sellerLoginTab');
    }
});

document.querySelectorAll('#sellerAuthModal .m-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        switchSellerAuthTab(tab.dataset.mtab);
    });
});

// Kurumsal Satıcı Başvurusu
$('sellerApplyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = $('applyFirstName').value.trim();
    const lastName = $('applyLastName').value.trim();

    db.sellerApplications.unshift({
        id: 'app_' + Date.now(),
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        phone: $('applyPhone').value.trim(),
        email: $('applyEmail').value.trim(),
        companyName: $('applyCompanyName').value.trim(),
        taxOrTc: $('applyTaxOrTc').value.trim(),
        address: $('applyAddress').value.trim(),
        date: new Date().toLocaleDateString('tr-TR')
    });

    await saveDB();
    $('sellerApplyForm').reset();
    $('sellerAuthModal').classList.add('hidden');
    showToast('Kurumsal satıcı başvurunuz alındı ve yönetim paneline kaydedildi.');
});

// Satıcı Girişi
$('sellerLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadDB();
    const u = $('sellerLoginUser').value.trim();
    const p = $('sellerLoginPass').value.trim();

    const seller = db.sellers.find(s => s.username === u && s.password === p);
    if (!seller) {
        showToast('Kullanıcı adı veya şifre hatalı!');
        return;
    }
    if (!seller.active) {
        showToast('Satıcı hesabınız şu anda pasif durumda.');
        return;
    }

    currentSeller = seller;
    $('sellerAuthModal').classList.add('hidden');
    $('sellerLoginForm').reset();
    switchMainView('sellerDashboardView');
    renderSellerDashboard();
    showToast(`${seller.companyName} paneline hoş geldiniz.`);
});

// PC / Telefon Görsel Seçimi -> Sıkıştırıp Kalıcı Görsel Verisi Hazırla
$('prodImageFile').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Görsel hazırlanıyor...');
    try {
        const base64Img = await compressImageToBase64(file, 700, 0.72);
        if (base64Img.length > 750000) {
            const smallerImg = await compressImageToBase64(file, 500, 0.6);
            uploadedImageUrl = smallerImg;
        } else {
            uploadedImageUrl = base64Img;
        }
        $('prodImagePreview').src = uploadedImageUrl;
        $('imagePreviewContainer').classList.remove('hidden');
        showToast('Görsel hazır, ürünü kaydedince kalıcı yayınlanacak.');
    } catch (err) {
        showToast('Görsel işlenemedi, farklı bir resim deneyin.');
    }
});

// Satıcı Ürün Ekle / Düzenle
$('sellerProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSeller) return;

    const editId = $('editProductId').value;
    const name = $('prodName').value.trim();
    const category = $('prodCategory').value;
    const oldPrice = parseFloat($('prodOldPrice').value);
    const price = parseFloat($('prodPrice').value);
    const shipping = parseFloat($('prodShipping').value);
    const stock = parseInt($('prodStock').value, 10);
    const desc = $('prodDesc').value.trim();

    if (!editId && !uploadedImageUrl) {
        showToast('Lütfen ürün için bir görsel seçin.');
        return;
    }

    if (editId) {
        const prod = db.products.find(p => p.id === editId);
        if (prod) {
            prod.name = name;
            prod.category = category;
            prod.oldPrice = oldPrice;
            prod.price = price;
            prod.shipping = shipping;
            prod.stock = stock;
            prod.desc = desc;
            if (uploadedImageUrl) prod.image = uploadedImageUrl;
        }
        showToast('Ürün güncellendi.');
    } else {
        db.products.unshift({
            id: 'prod_' + Date.now(),
            sellerId: currentSeller.id,
            sellerName: currentSeller.companyName,
            name,
            category,
            oldPrice,
            price,
            shipping,
            stock,
            image: uploadedImageUrl,
            desc
        });
        showToast('Yeni ürün kalıcı olarak yayına alındı.');
    }

    await saveDB();
    resetSellerProductForm();
    renderSellerDashboard();
    renderProducts();
});

window.editSellerProduct = function(prodId) {
    const prod = db.products.find(p => p.id === prodId);
    if (!prod) return;

    $('editProductId').value = prod.id;
    $('prodName').value = prod.name;
    $('prodCategory').value = prod.category;
    $('prodOldPrice').value = prod.oldPrice;
    $('prodPrice').value = prod.price;
    $('prodShipping').value = prod.shipping;
    $('prodStock').value = prod.stock;
    $('prodDesc').value = prod.desc || '';
    uploadedImageUrl = prod.image;
    $('prodImagePreview').src = prod.image;
    $('imagePreviewContainer').classList.remove('hidden');

    $('productFormHeading').innerHTML = `<i class="fa-solid fa-pen"></i> Ürünü Düzenle: ${prod.name}`;
    $('saveProductBtn').innerHTML = `<i class="fa-solid fa-check"></i> Değişiklikleri Kaydet`;
    $('cancelEditProductBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetSellerProductForm() {
    $('sellerProductForm').reset();
    $('editProductId').value = '';
    uploadedImageUrl = '';
    $('imagePreviewContainer').classList.add('hidden');
    $('productFormHeading').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Yeni Ürün Ekle`;
    $('saveProductBtn').innerHTML = `<i class="fa-solid fa-save"></i> Ürünü Kaydet ve Yayınla`;
    $('cancelEditProductBtn').classList.add('hidden');
}
$('cancelEditProductBtn').addEventListener('click', resetSellerProductForm);

window.deleteSellerProduct = async function(prodId) {
    if (!confirm('Bu ürünü kalıcı olarak silmek istediğinize emin misiniz?')) return;
    db.products = db.products.filter(p => p.id !== prodId);
    await saveDB();
    renderSellerDashboard();
    renderProducts();
    showToast('Ürün silindi.');
};

window.completeSellerOrder = async function(orderId) {
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'completed';
        await saveDB();
        renderSellerDashboard();
        showToast('Sipariş tamamlandı olarak işaretlendi.');
    }
};

function renderSellerDashboard() {
    if (!currentSeller) return;
    $('sellerStoreTitle').textContent = `${currentSeller.companyName} — ${currentSeller.fullName}`;

    const myProducts = db.products.filter(p => p.sellerId === currentSeller.id);
    const myOrders = db.orders.filter(o => o.sellerId === currentSeller.id);
    const pendingOrders = myOrders.filter(o => o.status === 'pending');
    const completedOrders = myOrders.filter(o => o.status === 'completed');

    const totalRevenue = myOrders.reduce((sum, o) => sum + Number(o.total), 0);

    $('sellerTotalRevenue').textContent = formatMoney(totalRevenue);
    $('sellerPendingOrdersCount').textContent = pendingOrders.length;
    $('sellerCompletedOrdersCount').textContent = completedOrders.length;
    $('sellerProductCount').textContent = myProducts.length;

    $('sellerProductsTableBody').innerHTML = myProducts.length === 0
        ? `<tr><td colspan="7" style="text-align:center;">Henüz ürün eklenmemiş.</td></tr>`
        : myProducts.map(p => `
            <tr>
                <td><img src="${p.image}" class="table-thumb"></td>
                <td><strong>${p.name}</strong><br><small>${p.category}</small></td>
                <td>${formatMoney(p.oldPrice)}</td>
                <td style="color:#f27a1a; font-weight:700;">${formatMoney(p.price)}</td>
                <td>${Number(p.shipping) === 0 ? 'Ücretsiz' : formatMoney(p.shipping)}</td>
                <td>${p.stock} adet</td>
                <td>
                    <button class="btn-sm btn-outline" onclick="editSellerProduct('${p.id}')"><i class="fa-solid fa-pen"></i> Düzenle</button>
                    <button class="btn-sm btn-danger" onclick="deleteSellerProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');

    $('sellerIncomingOrdersBody').innerHTML = pendingOrders.length === 0
        ? `<tr><td colspan="6" style="text-align:center;">Gelen yeni sipariş bulunmuyor.</td></tr>`
        : pendingOrders.map(o => `
            <tr>
                <td><strong>${o.id}</strong><br><small>${o.date}</small></td>
                <td>${o.customerName}<br><small>${o.customerPhone} - ${o.customerAddress}</small></td>
                <td>${o.itemsText}</td>
                <td><strong>${formatMoney(o.total)}</strong></td>
                <td>${o.paymentMethod}</td>
                <td><button class="btn-sm btn-primary" onclick="completeSellerOrder('${o.id}')"><i class="fa-solid fa-check"></i> Tamamla</button></td>
            </tr>
        `).join('');

    $('sellerCompletedOrdersBody').innerHTML = completedOrders.length === 0
        ? `<tr><td colspan="6" style="text-align:center;">Tamamlanmış sipariş bulunmuyor.</td></tr>`
        : completedOrders.map(o => `
            <tr>
                <td><strong>${o.id}</strong></td>
                <td>${o.customerName}</td>
                <td>${o.itemsText}</td>
                <td style="color:#16a34a; font-weight:700;">${formatMoney(o.total)}</td>
                <td>${o.date}</td>
                <td><span style="color:#16a34a; font-weight:600;">Tamamlandı</span></td>
            </tr>
        `).join('');
}

// ==========================================
// 5. GİZLİ SÜPER ADMIN PANELİ
// ==========================================
let logoClickCount = 0;
let logoClickTimer = null;

$('secretAdminTrigger').addEventListener('click', () => {
    logoClickCount++;
    clearTimeout(logoClickTimer);
    logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
    if (logoClickCount >= 5) {
        logoClickCount = 0;
        $('adminLoginModal').classList.remove('hidden');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        e.preventDefault();
        $('adminLoginModal').classList.remove('hidden');
    }
});

if (new URLSearchParams(window.location.search).get('admin') === 'trendtan') {
    $('adminLoginModal').classList.remove('hidden');
}

$('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadDB();
    if ($('superAdminPassInput').value === db.adminPassword) {
        $('adminLoginModal').classList.add('hidden');
        $('adminLoginForm').reset();
        switchMainView('superAdminDashboardView');
        renderAdminDashboard();
        showToast('Süper Admin Paneli açıldı.');
    } else {
        showToast('Yönetici şifresi hatalı!');
    }
});

function renderAdminDashboard() {
    const platformRev = db.orders.reduce((s, o) => s + Number(o.total), 0);
    $('adminTotalPlatformRevenue').textContent = formatMoney(platformRev);
    $('adminPendingAppsCount').textContent = db.sellerApplications.length;
    $('adminActiveSellersCount').textContent = db.sellers.length;
    $('adminCustomerCount').textContent = db.customers.length;

    $('adminApplicationsBody').innerHTML = db.sellerApplications.length === 0
        ? `<tr><td colspan="7" style="text-align:center;">Bekleyen satıcı başvurusu bulunmuyor.</td></tr>`
        : db.sellerApplications.map(app => `
            <tr>
                <td><strong>${app.companyName}</strong></td>
                <td>${app.fullName}</td>
                <td>${app.phone}<br><small>${app.email}</small></td>
                <td><code>${app.taxOrTc}</code></td>
                <td>${app.address}</td>
                <td>${app.date}</td>
                <td>
                    <button class="btn-sm btn-primary" onclick="openApproveModal('${app.id}')">İncele & Onayla</button>
                    <button class="btn-sm btn-danger" onclick="rejectApplication('${app.id}')">Reddet</button>
                </td>
            </tr>
        `).join('');

    $('adminSellersListBody').innerHTML = db.sellers.length === 0
        ? `<tr><td colspan="7" style="text-align:center;">Henüz onaylanmış satıcı hesabı yok.</td></tr>`
        : db.sellers.map(s => `
            <tr>
                <td><strong>${s.companyName}</strong><br><small>${s.fullName}</small></td>
                <td>VKN/TC: <code>${s.taxOrTc}</code><br><small>${s.address}</small></td>
                <td><code>${s.username}</code></td>
                <td><code>${s.password}</code></td>
                <td>${s.phone}<br><small>${s.email}</small></td>
                <td>${s.active ? '<span style="color:#16a34a;font-weight:700;">Aktif</span>' : '<span style="color:#dc2626;font-weight:700;">Pasif</span>'}</td>
                <td>
                    <button class="btn-sm btn-outline" onclick="toggleSellerStatus('${s.id}')">${s.active ? 'Pasife Al' : 'Aktifleştir'}</button>
                    <button class="btn-sm btn-danger" onclick="deleteSeller('${s.id}')">Sil</button>
                </td>
            </tr>
        `).join('');

    $('adminCustomersListBody').innerHTML = db.customers.length === 0
        ? `<tr><td colspan="7" style="text-align:center;">Henüz alışveriş yapan müşteri kaydı bulunmuyor.</td></tr>`
        : db.customers.map(c => `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td>${c.address}</td>
                <td style="color:#16a34a; font-weight:700;">${formatMoney(c.totalSpent)}</td>
                <td>${c.orderCount} sipariş</td>
                <td>${c.lastOrderDate}</td>
                <td><button class="btn-sm btn-danger" onclick="deleteCustomer('${c.id}')">Kaydı Sil</button></td>
            </tr>
        `).join('');

    $('adminCouponsBody').innerHTML = db.coupons.map((c, idx) => `
        <tr>
            <td><strong>${c.code}</strong></td>
            <td>${c.type === 'percent' ? 'Yüzde (%)' : 'Sabit Tutar (₺)'}</td>
            <td>${c.type === 'percent' ? '%' + c.value : formatMoney(c.value)}</td>
            <td><button class="btn-sm btn-danger" onclick="deleteCoupon(${idx})">Sil</button></td>
        </tr>
    `).join('');

    $('posProvider').value = db.posConfig.provider || 'paytr';
    $('posApiKey').value = db.posConfig.apiKey || '';
    $('posSecretKey').value = db.posConfig.secretKey || '';
    $('posMerchantSalt').value = db.posConfig.merchantSalt || '';
}

window.openApproveModal = function(appId) {
    const app = db.sellerApplications.find(a => a.id === appId);
    if (!app) return;

    $('approveAppId').value = app.id;
    $('approveApplicantDetails').innerHTML = `
        <strong>Firma Tam Adı:</strong> ${app.companyName}<br>
        <strong>Yetkili:</strong> ${app.fullName}<br>
        <strong>Telefon / E-Posta:</strong> ${app.phone} — ${app.email}<br>
        <strong>VKN / T.C. Kimlik:</strong> ${app.taxOrTc}<br>
        <strong>Açık Adres:</strong> ${app.address}
    `;
    $('assignSellerUsername').value = app.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
    $('assignSellerPassword').value = Math.floor(100000 + Math.random() * 900000);
    $('approveSellerModal').classList.remove('hidden');
};

$('approveSellerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const appId = $('approveAppId').value;
    const app = db.sellerApplications.find(a => a.id === appId);
    if (!app) return;

    db.sellers.push({
        id: 'seller_' + Date.now(),
        firstName: app.firstName,
        lastName: app.lastName,
        fullName: app.fullName,
        companyName: app.companyName,
        taxOrTc: app.taxOrTc,
        address: app.address,
        phone: app.phone,
        email: app.email,
        username: $('assignSellerUsername').value.trim(),
        password: $('assignSellerPassword').value.trim(),
        active: true
    });

    db.sellerApplications = db.sellerApplications.filter(a => a.id !== appId);
    await saveDB();
    $('approveSellerModal').classList.add('hidden');
    renderAdminDashboard();
    showToast('Satıcı başvurusu onaylandı ve hesap oluşturuldu.');
});

window.rejectApplication = async function(appId) {
    if (!confirm('Bu satıcı başvurusunu reddetmek istediğinize emin misiniz?')) return;
    db.sellerApplications = db.sellerApplications.filter(a => a.id !== appId);
    await saveDB();
    renderAdminDashboard();
    showToast('Başvuru reddedildi.');
};

window.toggleSellerStatus = async function(sellerId) {
    const s = db.sellers.find(x => x.id === sellerId);
    if (s) {
        s.active = !s.active;
        await saveDB();
        renderAdminDashboard();
        renderProducts();
    }
};

window.deleteSeller = async function(sellerId) {
    if (!confirm('Bu satıcıyı ve bağlı ürünlerini silmek istediğinize emin misiniz?')) return;
    db.sellers = db.sellers.filter(s => s.id !== sellerId);
    db.products = db.products.filter(p => p.sellerId !== sellerId);
    await saveDB();
    renderAdminDashboard();
    renderProducts();
};

window.deleteCustomer = async function(customerId) {
    if (!confirm('Bu müşteri kaydını silmek istediğinize emin misiniz?')) return;
    db.customers = db.customers.filter(c => c.id !== customerId);
    await saveDB();
    renderAdminDashboard();
};

$('adminCouponForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    db.coupons.push({
        code: $('newCouponCode').value.trim().toUpperCase(),
        type: $('newCouponType').value,
        value: parseFloat($('newCouponValue').value)
    });
    await saveDB();
    $('adminCouponForm').reset();
    renderAdminDashboard();
    showToast('Kupon eklendi.');
});

window.deleteCoupon = async function(index) {
    db.coupons.splice(index, 1);
    await saveDB();
    renderAdminDashboard();
};

$('posSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    db.posConfig = {
        provider: $('posProvider').value,
        apiKey: $('posApiKey').value.trim(),
        secretKey: $('posSecretKey').value.trim(),
        merchantSalt: $('posMerchantSalt').value.trim()
    };
    await saveDB();
    showToast('Sanal POS bilgileri kaydedildi.');
});

// ==========================================
// 6. GÖRÜNÜM VE SEKME YÖNETİMİ
// ==========================================
function switchMainView(viewId) {
    $('customerStoreView').classList.add('hidden');
    $('sellerDashboardView').classList.add('hidden');
    $('superAdminDashboardView').classList.add('hidden');
    $(viewId).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('backToStoreFromSeller').addEventListener('click', () => switchMainView('customerStoreView'));
$('backToStoreFromAdmin').addEventListener('click', () => switchMainView('customerStoreView'));

$('sellerLogoutBtn').addEventListener('click', () => {
    currentSeller = null;
    switchMainView('customerStoreView');
    showToast('Satıcı çıkışı yapıldı.');
});

$('adminLogoutBtn').addEventListener('click', () => {
    switchMainView('customerStoreView');
    showToast('Admin çıkışı yapıldı.');
});

document.querySelectorAll('.dash-tabs').forEach(tabBar => {
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('.dashboard-section');
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            $(btn.dataset.tab).classList.add('active');
        });
    });
});

document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        $(btn.dataset.close).classList.add('hidden');
    });
});

// Firestore Canlı Senkronizasyonu Başlat
initFirestoreSync();