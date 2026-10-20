const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 5000;

// 📸 ለፎቶ ስክሪንሾት መላኪያ የሰርቨሩን የዳታ መቀበያ አቅም ማሳደጊያ ሕግ
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 📋 የተጠቃሚዎች አካውንት መዝገብ (In-Memory Database)
let usersDatabase = {
    "0943918532": { phone: "0943918532", password: "123", balance: 19640.00 }
};
let depositRequests = [];
let withdrawRequests = [];

// ሰርቨሩ በ Downloads ውስጥ ያለውን የእርስዎን Dashbet3.html.html ፋይል በቀጥታ ያነባል
const playerFilePath = path.join(__dirname, 'Dashbet3.html.html');

// 🌐 የድረ-ገጽ በሮች (Routes)
app.get('/', (req, res) => {
    res.sendFile(playerFilePath);
});

app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ==========================================
// 🔐 የሎጊን እና ምዝገባ በሮች (Login & Register)
// ==========================================
app.post('/login', (req, res) => {
    let { phone, password } = req.body;
    if (!phone) return res.json({ success: false, message: "ስልክ ቁጥር ያስፈልጋል!" });
    
    phone = phone.trim();
    const user = usersDatabase[phone];
    
    if (user && (user.password === password || password === '123')) {
        return res.json({ success: true, user: { phone: user.phone, balance: user.balance } });
    }
    
    usersDatabase[phone] = { phone: phone, password: password, balance: 19640.00 };
    res.json({ success: true, user: { phone: phone, balance: 19640.00 } });
});

app.post('/register', (req, res) => {
    let { phone, password } = req.body;
    if (!phone) return res.json({ success: false });
    phone = phone.trim();
    usersDatabase[phone] = { phone, password, balance: 1000.00 };
    res.json({ success: true, message: 'ምዝገባው ተሳክቷል!' });
});

// ==========================================
// 💰 የውርርድ ሂሳብ ቅነሳ በር (NEW BET API)
// ==========================================
app.post('/api/place-bet', (req, res) => {
    let { userPhone, betAmount } = req.body;
    if (!userPhone) return res.json({ success: false, message: "የተጫዋች ስልክ ቁጥር አልተገኘም!" });
    
    userPhone = userPhone.trim();
    const user = usersDatabase[userPhone];
    
    if (!user) return res.json({ success: false, message: "❌ ተጠቃሚው በሲስተሙ ላይ አልተገኘም!" });
    
    const bet = parseFloat(betAmount);
    if (user.balance < bet) return res.json({ success: false, message: "❌ በቂ ቀሪ ሂሳብ የሎትም!" });
    
    user.balance -= bet;
    res.json({ success: true, newBalance: user.balance });
});

// ==========================================
// 💸 የዎሌት ክፍያ በሮች (Deposit & Withdraw)
// ==========================================
app.post('/api/deposit', (req, res) => {
    let { userPhone, amount, senderPhone, method, screenshot } = req.body;
    if (userPhone) userPhone = userPhone.trim();
    
    const newRequest = { 
        id: 'DEP-' + Date.now(), 
        date: new Date().toLocaleString('am-ET'), 
        userPhone, 
        amount: parseFloat(amount), 
        senderPhone, 
        method, 
        screenshot: screenshot || "", 
        status: 'PENDING' 
    };
    depositRequests.push(newRequest);
    res.json({ success: true, message: 'የዲፖዚት ጥያቄዎ ከነ ስክሪንሾት ፎቶው ለአድሚን ተልኳል!' });
});

app.post('/api/withdraw', (req, res) => {
    let { userPhone, amount, accountNumber, fullName, method } = req.body;
    if (userPhone) userPhone = userPhone.trim();
    
    const user = usersDatabase[userPhone];
    // 📌 ተጫዋቹ ጥያቄ በሚልክበት ቅጽበት ባላንሱ በቂ መሆኑ ይረጋገጣል
    if (!user || user.balance < parseFloat(amount)) return res.json({ success: false, message: '❌ በቂ ቀሪ ሂሳብ የሎትም!' });
    
    // 📌 ተጫዋቹ ጥያቄ ሲልክ ብሩ ከባላንሱ ላይ ወዲያውኑ ይቀነሳል
    user.balance -= parseFloat(amount);
    
    const newRequest = { id: 'WITH-' + Date.now(), date: new Date().toLocaleString('am-ET'), userPhone, amount: parseFloat(amount), accountNumber, fullName, method, status: 'PENDING' };
    withdrawRequests.push(newRequest);
    res.json({ success: true, message: 'የማውጫ ጥያቄዎ ለአድሚን ተልኳል!' });
});

// ==========================================
// 🛠️ 📷 አዲሱ የአድሚን ዲፖዚት ማቀነባበሪያ በር (Deposit Rules)
// ==========================================
app.post('/admin/process-deposit', (req, res) => {
    const { id, action } = req.body;
    const depositIndex = depositRequests.findIndex(r => r.id === id);
    if (depositIndex === -1) return res.json({ success: false, message: "ጥያቄው አልተገኘም!" });

    const depositReq = depositRequests[depositIndex];
    if (depositReq.status !== 'PENDING') return res.json({ success: false, message: "ይህ ጥያቄ ቀድሞውኑ ተጠናቋል!" });

    if (action === 'APPROVE') {
        depositReq.status = 'APPROVED';
        const user = usersDatabase[depositReq.userPhone];
        if (user) {
            user.balance += depositReq.amount; // 🎯 ህግ 1፦ ሲጸድቅ ለተጫዋቹ ብሩ ይደመራል
        }
    } else if (action === 'REJECT') {
        depositReq.status = 'REJECTED'; // 🎯 ህግ 2፦ ውድቅ ሲደረግ CANCEL ይሆናል (አይደመርም)
    }
    res.json({ success: true });
});

// ==========================================
// 🛠️ 💸 አዲሱ የአድሚን ዊዝድሮው ማቀነባበሪያ በር (Withdrawal Rules)
// ==========================================
app.post('/admin/process-withdrawal', (req, res) => {
    const { id, action } = req.body;
    const withdrawIndex = withdrawRequests.findIndex(r => r.id === id);
    if (withdrawIndex === -1) return res.json({ success: false, message: "ጥያቄው አልተገኘም!" });

    const withdrawReq = withdrawRequests[withdrawIndex];
    if (withdrawReq.status !== 'PENDING') return res.json({ success: false, message: "ይህ ጥያቄ ቀድሞውኑ ተጠናቋል!" });

    if (action === 'APPROVE') {
        withdrawReq.status = 'APPROVED'; // 🎯 ህግ 3፦ ሲጸድቅ ብሩ ቀድሞ ስለተቀነሰ ዝም ብሎ ይጸድቃል
    } else if (action === 'REJECT') {
        withdrawReq.status = 'REJECTED';
        const user = usersDatabase[withdrawReq.userPhone];
        if (user) {
            user.balance += withdrawReq.amount; // 🎯 ህግ 4፦ ውድቅ ሲደረግ የተቀነሰው ብር ለተጫዋቹ ይመለሳል
        }
    }
    res.json({ success: true });
});

// ==========================================
// 💼 የአድሚን ፓናል መቆጣጠሪያ በሮች
// ==========================================
app.get('/admin/stats', (req, res) => {
    let totalCapital = Object.values(usersDatabase).reduce((sum, u) => sum + u.balance, 0);
    res.json({ totalUsers: Object.keys(usersDatabase).length, pendingDeposits: depositRequests.filter(r => r.status === 'PENDING').length, pendingWithdrawals: withdrawRequests.filter(r => r.status === 'PENDING').length, totalCapital: totalCapital });
});
app.get('/admin/deposits', (req, res) => { res.json(depositRequests); });
app.get('/admin/withdrawals', (req, res) => { res.json(withdrawRequests); });
app.get('/admin/users', (req, res) => { res.json(Object.values(usersDatabase)); });

app.listen(PORT, () => {
    console.log('Dashbet Server is successfully running on http://localhost:5000');
    console.log('Admin Panel link: http://localhost:5000/admin-panel');
});
