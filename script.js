import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ================= Firebase Configuration =================
const firebaseConfig = {
    apiKey: "AIzaSyD0Iso45TFPSP3_fqXgfG_DVn3y3qWfgGA",
    authDomain: "unilost-3ccc0.firebaseapp.com",
    projectId: "unilost-3ccc0",
    storageBucket: "unilost-3ccc0.firebasestorage.app",
    messagingSenderId: "680649043114",
    appId: "1:680649043114:web:b05bcd0e1f51cedd2af4d3",
    measurementId: "G-XCTZW6HXZ6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= DOM Elements =================
const views = { home: document.getElementById('home-view'), form: document.getElementById('form-view') };
const buttons = {
    reportLost: document.getElementById('btn-report-lost'),
    reportFound: document.getElementById('btn-report-found'),
    back: document.getElementById('btn-back'),
    cancel: document.getElementById('btn-cancel'),
    logo: document.getElementById('nav-logo')
};
const form = document.getElementById('report-form');
const submitBtn = document.getElementById('btn-submit');
const imageInput = document.getElementById('imageUpload');
const imagePreview = document.getElementById('image-preview');
const imagePreviewContainer = document.getElementById('image-preview-container');
const uploadIcon = document.getElementById('upload-icon');
const base64Output = document.getElementById('base64ImageOutput');
const reportsGrid = document.getElementById('reports-grid');
const emptyState = document.getElementById('empty-state');
const listLoader = document.getElementById('list-loader');

// ================= Utilities =================
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-blue-600');
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');

    toast.className = `toast flex items-center ${bgClass} text-white px-6 py-4 rounded-xl shadow-lg mb-2`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-xl mr-3"></i> <div><p class="font-medium">${message}</p></div>`;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function navigateTo(viewName, defaultType = null) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Object.values(views).forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('opacity-100');
    });
    const target = views[viewName];
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('opacity-100'), 50);

    if (viewName === 'form') {
        form.reset();
        resetImagePreview();
        if (defaultType) {
            document.querySelector(`input[name="reportType"][value="${defaultType}"]`).checked = true;
        }
    }
}

function resetImagePreview() {
    base64Output.value = '';
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    uploadIcon.classList.remove('hidden');
}

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = height * (MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function timeAgo(date) {
    if (!date) return 'เมื่อสักครู่';
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " ปีที่แล้ว";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " เดือนที่แล้ว";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " วันที่แล้ว";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ชั่วโมงที่แล้ว";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " นาทีที่แล้ว";
    return "เมื่อสักครู่";
}

// ================= Event Listeners =================
buttons.reportLost.addEventListener('click', () => navigateTo('form', 'lost'));
buttons.reportFound.addEventListener('click', () => navigateTo('form', 'found'));
buttons.back.addEventListener('click', () => navigateTo('home'));
buttons.cancel.addEventListener('click', () => navigateTo('home'));
buttons.logo.addEventListener('click', () => navigateTo('home'));

imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }

    try {
        uploadIcon.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        imagePreview.src = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/spinner.svg';
        
        const compressedBase64 = await compressImage(file);
        imagePreview.src = compressedBase64;
        base64Output.value = compressedBase64;
    } catch (error) {
        console.error('Image error:', error);
        showToast('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ', 'error');
        resetImagePreview();
    }
});

// ================= บันทึกข้อมูลลง Firestore =================
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        type: document.querySelector('input[name="reportType"]:checked').value,
        name: document.getElementById('itemName').value.trim(),
        description: document.getElementById('itemDesc').value.trim(),
        contact: document.getElementById('contactInfo').value.trim(),
        image: base64Output.value || null,
        createdAt: serverTimestamp()
    };

    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังบันทึก...';
    submitBtn.disabled = true;

    try {
        const reportsRef = collection(db, 'reports');
        await addDoc(reportsRef, formData);
        
        showToast('บันทึกข้อมูลเรียบร้อยแล้ว!', 'success');
        navigateTo('home');
    } catch (error) {
        console.error("Error adding document: ", error);
        showToast('บันทึกไม่สำเร็จ! กรุณาตรวจสอบสิทธิ์ Firestore Rules', 'error');
    } finally {
        submitBtn.innerHTML = originalBtnHtml;
        submitBtn.disabled = false;
    }
});

// ================= ดึงข้อมูลจาก Firestore =================
function loadReports() {
    listLoader.classList.remove('hidden');
    
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, orderBy('createdAt', 'desc'));
    
    onSnapshot(q, (snapshot) => {
        reportsGrid.innerHTML = '';
        
        if (snapshot.empty) {
            emptyState.classList.remove('hidden');
            listLoader.classList.add('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');

        snapshot.forEach((doc) => {
            const report = doc.data();
            const isLost = report.type === 'lost';
            
            const typeBadge = isLost 
                ? `<span class="bg-indigo-100 text-luxury-navy px-3 py-1 rounded-full text-xs font-bold"><i class="fa-solid fa-bullhorn mr-1"></i> ของหาย</span>`
                : `<span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold"><i class="fa-solid fa-hand-holding-heart mr-1"></i> เจอของ</span>`;
            
            const borderColor = isLost ? 'border-indigo-100' : 'border-yellow-100';
            const timeString = report.createdAt ? timeAgo(report.createdAt.toDate()) : 'เมื่อสักครู่';

            const imageHtml = report.image 
                ? `<img src="${report.image}" alt="${report.name}" class="w-full h-48 object-cover">`
                : `<div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-300"><i class="fa-solid fa-image text-4xl"></i></div>`;

            const cardHtml = `
                <div class="glass-card rounded-2xl overflow-hidden border ${borderColor} hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
                    <div class="relative">
                        ${imageHtml}
                        <div class="absolute top-3 left-3">${typeBadge}</div>
                    </div>
                    <div class="p-5">
                        <h3 class="font-bold text-xl text-gray-800 mb-2 line-clamp-1 group-hover:text-luxury-navy transition-colors">${report.name}</h3>
                        <p class="text-gray-600 text-sm mb-4 line-clamp-2 h-10">${report.description}</p>
                        
                        <div class="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
                            <p class="text-xs text-gray-500 mb-1">ติดต่อกลับ:</p>
                            <p class="font-medium text-sm text-luxury-navy flex items-center">
                                <i class="fa-brands fa-line text-green-500 mr-2 text-lg"></i> ${report.contact}
                            </p>
                        </div>
                        <div class="flex justify-between items-center text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
                            <span><i class="fa-regular fa-clock mr-1"></i> ${timeString}</span>
                        </div>
                    </div>
                </div>
            `;
            reportsGrid.insertAdjacentHTML('beforeend', cardHtml);
        });
        listLoader.classList.add('hidden');
    }, (error) => {
        console.error("Error fetching reports:", error);
        listLoader.classList.add('hidden');
    });
}

// เริ่มดึงข้อมูลเมื่อเปิดหน้าเว็บ
loadReports();
