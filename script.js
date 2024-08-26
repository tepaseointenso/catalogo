import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { showLoading, hideLoading, showSuccess, showError } from './alerts.js';





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
export const auth = getAuth(app);

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
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});


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
    showLoading('Cargando productos...');

    try {
        await dbReady;
        const querySnapshot = await getDocs(collection(firestoreDb, "products"));
        products = [];

        querySnapshot.forEach((doc) => {
            const product = doc.data();
            product.id = doc.id;
            products.push(product);
        });

        products.forEach((product, index) => {
            addProductToDOM(product, index);
        });

        updateRealizedEarnings();
        updatePotentialEarnings();
        updateEarnings();

        showSuccess('Productos cargados exitosamente.');
    } catch (error) {
        showError('Error al cargar productos de Firestore: ' + error.message);
    } finally {
        hideLoading();
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
    const referentialPrice = parseInt(document.getElementById('referentialPrice').value, 10);
    const link = document.getElementById('link').value;

    if (image && image !== '' && image !== 'data:,') {
        const productData = {
            name,
            salePrice,
            referentialPrice,
            purchasePrice,
            image, // Guardar la imagen como data URL,
            link,
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
            <button class="delete-button btn admin-only">×</button>
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="price">Precio de Venta: $${product.salePrice}</div>
                ${product.referentialPrice ? `<div class="price line-through">Precio referencial: $${product.referentialPrice}</div>` : ''}
            ${product.link ? `<button class="btn btn-link" onclick="window.open('${product.link}', '_blank')">Ver Producto Referencial</button>` : ''}
                <div class="admin-only">
                    <div class="purchase-price">Precio de Compra: $${product.purchasePrice}</div>
                    <button class="toggle-purchase-price">Mostrar Precio de Compra</button>
                    <div class="product-sold">
                        <label>
                            <input type="checkbox" ${product.sold ? 'checked' : ''}> Marcar como vendido
                        </label>
                    </div>
                    <div class="product-edit">
                        <button class="edit-product">Editar Producto</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const productList = document.getElementById('productList');
    productList.insertAdjacentHTML('beforeend', productHtml);

    const productElement = productList.lastElementChild;
    const deleteButton = productElement.querySelector('.delete-button');
    const editButton = productElement.querySelector('.edit-product');
    const toggleButton = productElement.querySelector('.toggle-purchase-price');
    const checkbox = productElement.querySelector('.product-sold input[type="checkbox"]');

    deleteButton.addEventListener('click', function () {
        deleteProduct(index);
    });
    editButton.addEventListener('click', function () {
        editProduct(index);
    });
    toggleButton.addEventListener('click', function () {
        togglePurchasePrice(toggleButton);
    });
    checkbox.addEventListener('change', function () {
        markAsSold(checkbox, product.salePrice, product.purchasePrice);
    });
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

async function markAsSold(checkbox, salePrice, purchasePrice) {
    const productDiv = checkbox.closest('.product');
    const productIndex = parseInt(productDiv.getAttribute('data-index'));
    const product = products[productIndex];
    const isSold = checkbox.checked;

    console.log(product);

    // Actualizar el estado del producto en el DOM
    if (isSold) {
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

    const productRef = doc(firestoreDb, "products", product.id);

    // Mostrar SweetAlert de carga
    const loadingAlert = Swal.fire({
        title: 'Actualizando...',
        text: 'Por favor, espere mientras se actualiza el producto.',
        didOpen: () => {
            Swal.showLoading();
        },
        allowOutsideClick: false, // Opcional: previene el cierre del alert haciendo clic fuera de él
    });

    try {
        // Setear el campo como vendido
        await updateDoc(productRef, {
            sold: product.sold
        });

        console.log('Producto actualizado correctamente en Firestore.');
        saveProducts();

        // Ocultar SweetAlert de carga
        loadingAlert.close();

        // Actualizar las ganancias en el DOM
        updateEarnings();
        updateRealizedEarnings();
    } catch (error) {
        console.error('Error al actualizar el producto en Firestore:', error);

        // Revertir el cambio en el DOM en caso de error
        checkbox.checked = !isSold;
        productDiv.classList.toggle('sold-item');
        if (isSold) {
            totalEarnings -= salePrice;
            product.sold = false;
        } else {
            totalEarnings += salePrice;
            product.sold = true;
        }

        // Ocultar SweetAlert de carga
        loadingAlert.close();

        // Mostrar mensaje de error
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el producto. Intenta de nuevo.',
        });
    }
}


function updatePotentialEarnings() {
    potentialEarnings = products.reduce((acc, product) => acc + (product.salePrice - product.purchasePrice), 0);
    document.getElementById('potentialEarnings').textContent = `Ganancias Potenciales 📈: $${potentialEarnings}`;
}

function editProduct(index) {
    const product = products[index]; // Obtén el producto basado en el índice

    Swal.fire({
        title: 'Editar Producto',
        html: `
            <input type="text" id="productName" class="swal2-input" placeholder="Nombre" value="${product.name}">
            <input type="number" id="salePrice" class="swal2-input" placeholder="Precio de Venta" value="${product.salePrice}">
            <input type="number" id="purchasePrice" class="swal2-input" placeholder="Precio de Compra" value="${product.purchasePrice}">
            <input type="number" id="referentialPrice" class="swal2-input" placeholder="Precio Referencial" value="${product.referentialPrice || ''}">
            <input type="url" id="link" class="swal2-input" placeholder="Link del Producto Referencial" value="${product.link || ''}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            const name = document.getElementById('productName').value.trim();
            const salePrice = document.getElementById('salePrice').value.trim() || product.salePrice;
            const purchasePrice = document.getElementById('purchasePrice').value.trim() || product.purchasePrice;
            const referentialPrice = document.getElementById('referentialPrice').value.trim() || product.referentialPrice || '';
            const link = document.getElementById('link').value.trim() || product.link || '';

            return {
                name,
                salePrice: salePrice,
                purchasePrice: purchasePrice,
                referentialPrice: referentialPrice ? parseFloat(referentialPrice) : null,
                link: link ? link : null
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const updatedProduct = result.value;
            console.log(updatedProduct)
            // Actualiza el producto en Firebase
            const productRef = doc(firestoreDb, "products", product.id);
            await updateDoc(productRef, updatedProduct)
            Swal.fire('Actualizado', 'El producto ha sido actualizado correctamente.', 'success');
            // location.reload()

        }
    });
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
            const product = products[index];
            const productId = product.id; // ID del documento en Firestore

            // Mostrar SweetAlert de carga
            const loadingAlert = Swal.fire({
                title: 'Eliminando...',
                text: 'Por favor, espere mientras se elimina el producto.',
                didOpen: () => {
                    Swal.showLoading();
                },
                allowOutsideClick: false,
            });

            // Eliminar el documento en Firestore
            const productRef = doc(firestoreDb, "products", productId);
            deleteDoc(productRef)
                .then(() => {
                    // Eliminar el producto de la lista en la interfaz
                    products.splice(index, 1);
                    const productDiv = document.querySelector(`.product[data-index="${index}"]`);
                    if (productDiv) {
                        productDiv.remove();
                    }

                    // Actualizar las ganancias y la lista de productos
                    if (product.sold) {
                        totalEarnings -= product.salePrice;
                    }
                    updatePotentialEarnings();
                    updateEarnings();
                    updateRealizedEarnings();
                    saveProducts();

                    // Ocultar SweetAlert de carga
                    loadingAlert.close();
                    showSuccess('Producto eliminado exitosamente.');
                })
                .catch((error) => {
                    console.error('Error al eliminar el producto de Firestore:', error);

                    // Ocultar SweetAlert de carga
                    loadingAlert.close();
                    showError('No se pudo eliminar el producto. Intenta de nuevo.');
                });
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
    // Inicializa la base de datos y carga productos
    dbReady.then(() => {
        loadProductsFromFirestore();
        updateRealizedEarnings();
        updatePotentialEarnings();
        updateEarnings();
    }).catch(error => {
        console.error('Error initializing database:', error);
    });

    // Verifica el estado de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Referencia al documento del usuario en Firestore
                const userDocRef = doc(firestoreDb, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (!userDoc.exists()) {
                    // Obtener el objeto user en formato JSON y agregar el campo 'role'
                    const userData = {
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        uid: user.uid,
                        role: 'user'  // Asignar el rol por defecto
                    };

                    // Agregar el usuario a Firestore
                    await setDoc(userDocRef, userData);
                }

                // Verificar el rol del usuario para mostrar/ocultar características administrativas
                const userData = userDoc.exists() ? userDoc.data() : (await getDoc(userDocRef)).data();
                if (userData.role === 'admin') {
                    showAdminFeatures();
                } else {
                    hideAdminFeatures();
                }

                // Mostrar el banner de sesión
                displaySessionBanner(user);
                showSessionBanner();
                hideLoginButton();
            } catch (error) {
                console.error('Error getting or creating user:', error);
                hideAdminFeatures();
            }
        } else {
            hideAdminFeatures();
            hideSessionBanner();
            showLoginButton();
        }
    });

    document.getElementById('logoutBannerButton').addEventListener('click', async () => {
        try {
            await auth.signOut();
            console.log('Usuario cerrado sesión');
            hideSessionBanner();
            showLoginButton();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    });

    const toggleDropdownButton = document.getElementById('toggleDropdown');
    if (toggleDropdownButton) {
        toggleDropdownButton.addEventListener('click', () => {
            const dropdownMenu = document.getElementById('dropdownMenu');
            if (dropdownMenu) {
                dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
});


function displaySessionBanner(user) {
    document.getElementById('userAvatar').src = user.photoURL || '';
    document.getElementById('userName').textContent = user.displayName || 'Nombre Usuario';
    document.getElementById('userEmail').textContent = user.email || 'usuario@example.com';
}

function showSessionBanner() {
    document.getElementById('sessionBanner').style.display = 'flex'; // Mostrar como un flex contenedor
}

function hideSessionBanner() {
    document.getElementById('sessionBanner').style.display = 'none';
}

function showLoginButton() {
    document.getElementById('loginGoogle').style.display = 'block';
}

function hideLoginButton() {
    document.getElementById('loginGoogle').style.display = 'none';
}

// Cerrar sesión en Firebase
document.getElementById('logoutButton').addEventListener('click', async function () {
    try {
        await auth.signOut();
        localStorage.removeItem('role');
        hideAdminFeatures();
        location.reload(); // Recargar la página para actualizar la interfaz
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Hubo un problema al cerrar sesión.');
    }
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
        showLoading('Guardando producto...');
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

        showSuccess('Producto guardado exitosamente.');
    } catch (error) {
        console.error('Error al guardar el producto en Firestore:', error);
        showError('Error al guardar el producto.');
    } finally {
        hideLoading();
    }
}

function sanitizeFileName(fileName) {
    // Reemplaza caracteres problemáticos en el nombre del archivo
    return fileName.replace(/[/\\?%*:|"<>]/g, '_'); // Reemplaza varios caracteres con '_'
}


function showAdminFeatures() {
    console.log('Showing admin features');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
}

function hideAdminFeatures() {
    console.log('Hiding admin features');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
}


document.getElementById('loginGoogle').addEventListener('click', async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, provider);
        location.reload();
    } catch (error) {
        showError('Error al iniciar sesión con Google: ' + error.message);
    }
});
