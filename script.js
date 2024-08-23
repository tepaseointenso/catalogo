import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";




// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAa0V2lzsYDn9shdWhq7YaremkNSxUxRY8",
    authDomain: "catalogo-productos-cea29.firebaseapp.com",
    databaseURL: "https://catalogo-productos-cea29-default-rtdb.firebaseio.com",
    projectId: "catalogo-productos-cea29",
    storageBucket: "catalogo-productos-cea29.appspot.com",
    messagingSenderId: "255523564384",
    appId: "1:255523564384:web:00d029adcee9969dff8c05",
    measurementId: "G-Q0MVS403GB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

let totalEarnings = 0;
let potentialEarnings = 0;
let realizedEarnings = 0;
let products = [];
const secretKey = 'pichula';

const dbName = 'productDB';
const storeName = 'images';


// Initialize Firestore
const firestoreDb = getFirestore(app);
const storage = getStorage();


let db;
let dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        const objectStore = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('image', 'image', { unique: false });
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        resolve(db);
    };

    request.onerror = function (event) {
        reject(event);
    };
});



async function loadProductsFromFirestore() {
    try {
        // Asegúrate de que Firestore esté inicializado
        await dbReady;

        // Obtener todos los productos de Firestore
        const querySnapshot = await getDocs(collection(firestoreDb, "products"));
        products = []; // Limpiar el array de productos existente

        // Mapear los datos de los documentos de Firestore a un array de productos
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            product.id = doc.id; // Agregar el ID del documento al producto
            products.push(product);
        });

        // Agregar los productos al DOM
        products.forEach((product, index) => {
            addProductToDOM(product, index);
        });

        updateRealizedEarnings();
        updatePotentialEarnings();
        updateEarnings();

    } catch (error) {
        console.error('Error loading products from Firestore:', error);
    }
}


document.getElementById('removeImageButton').addEventListener('click', function () {
    document.getElementById('image').value = ''; // Clear the file input
    document.getElementById('imagePreview').src = ''; // Clear the image preview
    document.getElementById('imagePreview').style.display = 'none'; // Hide the image preview
    document.getElementById('removeImageButton').style.display = 'none'; // Hide the remove button
});

document.getElementById('image').addEventListener('change', handleImageChange);

document.addEventListener('paste', handleImagePaste);


async function handleImageChange(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const imageData = e.target.result;
            const compressedImageData = await compressImage(imageData);

            // Actualizar la vista previa y el botón de eliminar
            const imagePreview = document.getElementById('imagePreview');
            imagePreview.src = compressedImageData;
            imagePreview.style.display = 'block'; // Mostrar vista previa
            document.getElementById('removeImageButton').style.display = 'block'; // Mostrar botón de eliminar
        };
        reader.readAsDataURL(file);
    }
}


async function handleImagePaste(event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            const reader = new FileReader();

            reader.onload = async function (e) {
                const imageData = e.target.result;

                // Comprimir la imagen usando la función compressImage
                const compressedImageData = await compressImage(imageData);

                // Actualizar la vista previa y el botón de eliminar
                const imagePreview = document.getElementById('imagePreview');
                imagePreview.src = compressedImageData;
                imagePreview.style.display = 'block'; // Mostrar vista previa
                document.getElementById('removeImageButton').style.display = 'block'; // Mostrar botón de eliminar

                // Guarda la imagen comprimida en una variable global o estado si es necesario
                window.pastedImageData = compressedImageData;
            };

            reader.readAsDataURL(file);
        }
    }
}



document.getElementById('productForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const salePrice = parseInt(document.getElementById('salePrice').value, 10);
    const purchasePrice = parseInt(document.getElementById('purchasePrice').value, 10);
    const image = document.getElementById('imagePreview').src;

    if (image && image !== '' && image !== 'data:,') {
        const productData = {
            name,
            salePrice,
            purchasePrice,
            image, // Guardar la imagen como data URL
            sold: false
        };

        await saveProductToFirestore(productData);

        // Resetear el formulario y ocultar la vista previa de la imagen
        document.getElementById('productForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('removeImageButton').style.display = 'none';
    } else {
        alert('Por favor, selecciona o pega una imagen válida.');
    }
});


function addProductToDOM(product, index) {
    const productHtml = `
        <div class="product ${product.sold ? 'sold-item' : ''}" data-index="${index}">
            <button class="delete-button btn admin-only" onclick="deleteProduct(${index})">×</button>
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="price">Precio de Venta: $${product.salePrice}</div>
                <div class="admin-only">
                    <div class="purchase-price">Precio de Compra: $${product.purchasePrice}</div>
                    <button onclick="togglePurchasePrice(this)">Mostrar Precio de Compra</button>
                    <div class="product-sold">
                        <label>
                            <input type="checkbox" onchange="markAsSold(this, ${product.salePrice}, ${product.purchasePrice})" ${product.sold ? 'checked' : ''}> Marcar como vendido
                        </label>
                    </div>
                    <div class="product-edit">
                        <button onclick="editProduct(${index})">Editar Producto</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('productList').insertAdjacentHTML('beforeend', productHtml);
}


function updateRealizedEarnings() {
    realizedEarnings = products.reduce((acc, product) => {
        if (product.sold) {
            return acc + (product.salePrice - product.purchasePrice);
        }
        return acc;
    }, 0);
    document.getElementById('realizedEarnings').textContent = `Ganancias Realizadas 📊: $${realizedEarnings}`;
}

function togglePurchasePrice(button) {
    const purchasePriceDiv = button.previousElementSibling;
    if (purchasePriceDiv.style.display === 'none' || purchasePriceDiv.style.display === '') {
        purchasePriceDiv.style.display = 'block';
        button.textContent = 'Ocultar Precio de Compra';
    } else {
        purchasePriceDiv.style.display = 'none';
        button.textContent = 'Mostrar Precio de Compra';
    }
}


function updateEarnings() {
    totalEarnings = products.reduce((acc, product) => {
        if (product.sold) {
            return acc + product.salePrice;
        }
        return acc;
    }, 0);
    document.getElementById('totalEarnings').textContent = `Total Ventas 💰: $${totalEarnings}`;
}

function markAsSold(checkbox, salePrice, purchasePrice) {
    const productDiv = checkbox.closest('.product');
    const productIndex = parseInt(productDiv.getAttribute('data-index'));
    const product = products[productIndex];

    if (checkbox.checked) {
        productDiv.classList.add('sold-item');
        if (!product.sold) {
            product.sold = true;
            totalEarnings += salePrice;
        }
    } else {
        productDiv.classList.remove('sold-item');
        if (product.sold) {
            product.sold = false;
            totalEarnings -= salePrice;
        }
    }

    updateEarnings();
    updateRealizedEarnings();
    saveProducts();
}

function updatePotentialEarnings() {
    potentialEarnings = products.reduce((acc, product) => acc + (product.salePrice - product.purchasePrice), 0);
    document.getElementById('potentialEarnings').textContent = `Ganancias Potenciales 📈: $${potentialEarnings}`;
}

function editProduct(index) {
    const product = products[index];
    const name = prompt('Nombre del Producto:', product.name);
    const salePrice = parseInt(prompt('Precio de Venta:', product.salePrice), 10);
    const purchasePrice = parseInt(prompt('Precio de Compra:', product.purchasePrice), 10);

    if (name && !isNaN(salePrice) && !isNaN(purchasePrice)) {
        product.name = name;
        product.salePrice = salePrice;
        product.purchasePrice = purchasePrice;

        const productDiv = document.querySelector(`.product[data-index="${index}"]`);
        if (productDiv) {
            productDiv.querySelector('h3').textContent = name;
            productDiv.querySelector('.price').textContent = `Precio de Venta: $${salePrice}`;
            productDiv.querySelector('.purchase-price').textContent = `Precio de Compra: $${purchasePrice}`;
        }

        updatePotentialEarnings();
        updateEarnings();
        saveProducts();
    }
}
function clearImagesFromDB() {
    if (!db) {
        console.error('Database is not initialized.');
        return;
    }

    const transaction = db.transaction([storeName], 'readwrite');
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.clear();

    request.onsuccess = function () {
        console.log('All images cleared from IndexedDB.');
    };

    request.onerror = function (event) {
        console.error('Error clearing images from IndexedDB:', event);
    };
}


function deleteProduct(index) {
    console.log('Índice de producto:', index);
    if (index >= 0 && index < products.length) {
        if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            const productDiv = document.querySelector(`.product[data-index="${index}"]`);
            const product = products[index];
            if (product.sold) {
                totalEarnings -= product.salePrice;
            }
            products.splice(index, 1);
            if (productDiv) {
                productDiv.remove();
            }
            updatePotentialEarnings();
            updateEarnings();
            updateRealizedEarnings();
            saveProducts();
        }
    } else {
        console.error('Índice de producto no válido:', index);
    }
}

function saveProducts() {
    const productsWithImageIds = products.map(product => ({
        name: product.name,
        salePrice: product.salePrice,
        purchasePrice: product.purchasePrice,
        sold: product.sold,
        imageId: product.imageId // Save the imageId
    }));
    localStorage.setItem('products', encryptData(JSON.stringify(productsWithImageIds), secretKey));
}


document.getElementById('exportButton').addEventListener('click', function () {
    exportData();
});

function exportData() {
    // Exportar datos del localStorage
    const productos = localStorage.getItem('products')
    const decrypt = decryptData(productos, secretKey)
    const productsData = decrypt;

    // Exportar imágenes de IndexedDB
    dbReady.then(() => {
        const transaction = db.transaction([storeName]);
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = function () {
            const imagesData = request.result;

            const exportData = {
                products: productsData,
                images: imagesData
            };

            // Convertir los datos a un archivo JSON
            const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'exported_data.json';
            a.click();

            URL.revokeObjectURL(url);
        };

        request.onerror = function (event) {
            console.error('Error exporting images from IndexedDB:', event);
        };
    }).catch(error => {
        console.error('Error initializing database:', error);
    });
}

document.getElementById('importButton').addEventListener('click', function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', handleFileSelect);
    input.click();
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = function (e) {
            const data = JSON.parse(e.target.result);

            // Restaurar datos en localStorage
            localStorage.setItem('products', encryptData(data.products, secretKey));

            // Restaurar imágenes en IndexedDB
            dbReady.then(() => {
                const transaction = db.transaction([storeName], 'readwrite');
                const objectStore = transaction.objectStore(storeName);
                data.images.forEach(imageData => {
                    objectStore.put(imageData);
                });

                transaction.oncomplete = function () {
                    console.log('Datos restaurados con éxito.');
                    location.reload(); // Opcional: Recargar la página para actualizar la interfaz
                };

                transaction.onerror = function (event) {
                    console.error('Error restaurando imágenes en IndexedDB:', event);
                };
            }).catch(error => {
                console.error('Error initializing database:', error);
            });
        };
        reader.readAsText(file);
    } else {
        alert('Por favor, selecciona un archivo JSON válido.');
    }
}
const adminUsername = 'tepaseointenso';
const adminPassword = '5408'; // Cambia esto por una contraseña más segura en producción

document.addEventListener('DOMContentLoaded', function () {

    const role = localStorage.getItem('role');
    if (role === 'admin') {
        showAdminFeatures();
    } else {
        hideAdminFeatures();
    }

    // Inicializa la base de datos y carga productos
    dbReady.then(() => {
        loadProductsFromFirestore();
        updateRealizedEarnings();
        updatePotentialEarnings();
        updateEarnings();
    }).catch(error => {
        console.error('Error initializing database:', error);
    });
});

document.getElementById('loginButton').addEventListener('click', function () {
    const username = prompt('Usuario:');
    const password = prompt('Contraseña:');
    if (username === adminUsername && password === adminPassword) {
        localStorage.setItem('role', 'admin');
        showAdminFeatures();
    } else {
        alert('Usuario o contraseña incorrectos.');
    }
});

function showAdminFeatures() {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    document.getElementById('loginButton').style.display = 'none';
}

function hideAdminFeatures() {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.getElementById('loginButton').style.display = 'block';
}

document.getElementById('logoutButton').addEventListener('click', function () {
    alert('Has cerrado sesión.');
    localStorage.removeItem('role');
    hideAdminFeatures();
    location.reload(); // Opcional: Recargar la página para actualizar la interfaz
});


function encryptData(data, secretKey) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
}

function decryptData(encryptedData, secretKey) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
}

async function compressImage(imageData, maxWidth = 800, maxHeight = 600, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imageData;
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const compressedImageData = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedImageData);
        };
    });
}


function dataURLtoFile(dataUrl, fileName) {
    const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mime });
}

document.getElementById('uploadButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Por favor, selecciona un archivo JSON.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const products = JSON.parse(data.products);
            const images = data.images;



            for (let i = 0; i < images.length; i++) {
                let imgData = images[i].image;
                let compressedImg = await compressImage(imgData);
                for (let product of products) {
                    if (product.imageId === images[i].id) {
                        product.image = compressedImg;

                    }
                }
            }

            for (let product of products) {
                await saveProductToFirestore(product)
            }

            alert('Productos y imágenes subidos correctamente.');
        } catch (error) {
            console.error('Error:', error);
            alert('Hubo un error al procesar el archivo.');
        }
    };
    reader.readAsText(file);
});

async function saveProductToFirestore(productData) {
    try {
        // Crear una referencia en Firebase Storage para la imagen
        const sanitizedFileName = sanitizeFileName(productData.name);
        const storageRef = ref(storage, `product-images/${sanitizedFileName}-${Date.now()}.jpg`);

        // Subir la imagen a Firebase Storage
        await uploadString(storageRef, productData.image, 'data_url');

        // Obtener la URL de descarga de la imagen
        const imageUrl = await getDownloadURL(storageRef);

        // Guardar la URL de la imagen y otros datos en Firestore
        productData.image = imageUrl; // Guardar la URL de la imagen en lugar de la imagen en sí

        const docRef = await addDoc(collection(firestoreDb, "products"), productData);
        console.log("Producto agregado con ID: ", docRef.id);

        // Puedes agregar la ID del documento a tu producto si es necesario
        productData.id = docRef.id;
        products.push(productData);
        addProductToDOM(productData);
        updatePotentialEarnings();
        saveProducts();
    } catch (error) {
        console.error('Error al guardar el producto en Firestore:', error);
    }
}

function sanitizeFileName(fileName) {
    // Reemplaza caracteres problemáticos en el nombre del archivo
    return fileName.replace(/[/\\?%*:|"<>]/g, '_'); // Reemplaza varios caracteres con '_'
}

