// Función para mostrar un mensaje de carga
export function showLoading(message) {
    Swal.fire({
        title: message || 'Cargando...',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

// Función para ocultar el mensaje de carga
export function hideLoading() {
    Swal.close();
}

// Función para mostrar un mensaje de éxito
export function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: message || 'Operación exitosa',
        timer: 1500,
        showConfirmButton: false
    });
}

// Función para mostrar un mensaje de error
export function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message || 'Ocurrió un error inesperado',
        confirmButtonText: 'Aceptar'
    });
}