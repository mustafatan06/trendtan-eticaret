const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Vercel ortamında yazılabilir dizin (/tmp), yerelde proje klasörü
const isVercel = process.env.VERCEL === '1';
const DB_FILE = isVercel
    ? path.join('/tmp', 'database.json')
    : path.join(__dirname, 'database.json');

const initialDatabase = {
    adminPassword: 'trendtan2026',
    posConfig: {
        provider: 'paytr',
        apiKey: '',
        secretKey: '',
        merchantSalt: ''
    },
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

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDatabase, null, 2), 'utf8');
        return initialDatabase;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Görselleri bellekten okuyup tüm cihazlarda kalıcı gösterilecek formata çevir
const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/db', (req, res) => {
    try {
        res.json(readDB());
    } catch (err) {
        res.status(500).json({ error: 'Veritabanı okunamadı' });
    }
});

app.post('/api/db', (req, res) => {
    try {
        writeDB(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Veritabanı kaydedilemedi' });
    }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Görsel seçilmedi' });
    }
    const base64 = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64}`;
    res.json({ success: true, imageUrl });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`TRENDTAN Sunucusu Aktif: http://localhost:${PORT}`);
    });
}

module.exports = app;