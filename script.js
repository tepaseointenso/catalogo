let totalEarnings = 0;
let potentialEarnings = 0;
let realizedEarnings = 0;
let products = [];
const secretKey = 'pichula';

const dbName = 'productDB';
const storeName = 'images';

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

document.addEventListener('DOMContentLoaded', function () {
    dbReady.then(() => {
        loadProductsFromLocalStorage()
        updateRealizedEarnings();
        updatePotentialEarnings();
        updateEarnings();
    }).catch(error => {
        console.error('Error initializing database:', error);
    });
});

function loadProductsFromLocalStorage() {
    dbReady.then(() => {
        const productos = localStorage.getItem('products')
        let decrypt = []
        let storedProducts
        if (productos) {
            decrypt = decryptData(productos, secretKey)
            storedProducts = JSON.parse(decrypt) || [];
            products = storedProducts;
        }
        else {
            products = []
        }
        console.log(decrypt)


        // Primero, recupera todas las imágenes de IndexedDB
        const transaction = db.transaction([storeName]);
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll(); // Obtener todas las imágenes

        request.onsuccess = function () {
            const images = request.result;
            const imageMap = new Map();
            images.forEach(imageData => imageMap.set(imageData.id, imageData.image));

            // Asociar cada producto con su imagen y agregar al DOM
            products.forEach((product, index) => {
                // Buscar la imagen para el producto actual
                const image = imageMap.get(product.imageId);
                if (image) {
                    product.image = image; // Asociar la imagen al producto
                }
                addProductToDOM(product, index);
            });

            updateRealizedEarnings();
            updatePotentialEarnings();
            updateEarnings();
        };

        request.onerror = function (event) {
            console.error('Error retrieving images from IndexedDB:', event);
        };
    }).catch(error => {
        console.error('Error initializing database:', error);
    });
}

document.getElementById('removeImageButton').addEventListener('click', function () {
    document.getElementById('image').value = ''; // Clear the file input
    document.getElementById('imagePreview').src = ''; // Clear the image preview
    document.getElementById('imagePreview').style.display = 'none'; // Hide the image preview
    document.getElementById('removeImageButton').style.display = 'none'; // Hide the remove button
});

document.getElementById('image').addEventListener('change', handleImageChange);

document.addEventListener('paste', handleImagePaste);


function handleImageChange(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const imageData = e.target.result;

            // Solo actualiza la vista previa y el botón de eliminar
            const imagePreview = document.getElementById('imagePreview');
            imagePreview.src = imageData;
            imagePreview.style.display = 'block'; // Show image preview
            document.getElementById('removeImageButton').style.display = 'block'; // Show remove button
        };
        reader.readAsDataURL(file);
    }
}

function handleImagePaste(event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = function (e) {
                const imageData = e.target.result;

                // Solo actualiza la vista previa y el botón de eliminar
                const imagePreview = document.getElementById('imagePreview');
                imagePreview.src = imageData;
                imagePreview.style.display = 'block'; // Show image preview
                document.getElementById('removeImageButton').style.display = 'block'; // Show remove button
            };
            reader.readAsDataURL(file);
        }
    }
}


document.getElementById('deleteAllButton').addEventListener('click', function () {
    if (confirm('¿Estás seguro de que quieres eliminar todos los productos?')) {
        products = []; // Vacía el array de productos
        document.getElementById('productList').innerHTML = ''; // Elimina todos los elementos del DOM
        totalEarnings = 0; // Reinicia las ganancias totales
        updateEarnings(); // Actualiza el DOM
        updatePotentialEarnings(); // Actualiza el DOM
        saveProducts(); // Guarda los cambios (vacío en este caso)
        clearImagesFromDB(); // Limpia las imágenes de IndexedDB
    }
});

document.getElementById('productForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const salePrice = parseInt(document.getElementById('salePrice').value, 10);
    const purchasePrice = parseInt(document.getElementById('purchasePrice').value, 10);
    const image = document.getElementById('imagePreview').src;

    if (image && image !== '' && image !== 'data:,') { // Validate image is not empty
        // Guardar la imagen en IndexedDB
        const transaction = db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.add({ image: image });

        request.onsuccess = function () {
            // Imagen guardada correctamente, ahora guardar el producto
            const imageId = request.result; // Get the ID of the newly added image
            const product = {
                name,
                salePrice,
                purchasePrice,
                image,
                sold: false,
                imageId // Assign the imageId to the product
            };
            products.push(product);
            addProductToDOM(product);
            updatePotentialEarnings();
            saveProducts();

            // Resetear el formulario y ocultar la vista previa de la imagen
            document.getElementById('productForm').reset();
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('removeImageButton').style.display = 'none';
        };

        request.onerror = function (event) {
            console.error('Error saving image to IndexedDB:', event);
        };
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
        loadProductsFromLocalStorage();
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
