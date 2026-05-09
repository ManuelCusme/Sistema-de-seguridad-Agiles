// USERMODELS.CS — ENTIDADES Y DTOS DE USUARIO CON NOMENCLATURA DEL EQUIPO
// Microservicio: UtaSecurity.Services.Identity
// Responsable: Emilio Abril (EMILIOABRIL05)
// Aplica de forma estricta la nomenclatura del equipo: prefijo 'usu' + CamelCase

using System;

namespace UtaSecurity.Services.Identity.Models
{
    /// <summary>
    /// Entidad de usuario persistente en el sistema de seguridad.
    /// </summary>
    public class UserEntity
    {
        // usuId: Identificador único del usuario
        public string usuId { get; set; } = Guid.NewGuid().ToString();

        // usuNombre1: Primer nombre del usuario (Requerido)
        public string usuNombre1 { get; set; } = string.Empty;

        // usuNombre2: Segundo nombre del usuario (Opcional)
        public string? usuNombre2 { get; set; }

        // usuApellido1: Primer apellido del usuario (Requerido)
        public string usuApellido1 { get; set; } = string.Empty;

        // usuApellido2: Segundo apellido del usuario (Opcional)
        public string? usuApellido2 { get; set; }

        // usuEmail: Correo electrónico institucional (Requerido y Único)
        public string usuEmail { get; set; } = string.Empty;

        // usuPasswordHash: Hash BCrypt de la contraseña del usuario
        public string usuPasswordHash { get; set; } = string.Empty;

        // usuBirthDate: Fecha de nacimiento (requerida para validación de edad)
        public DateTime usuBirthDate { get; set; }

        // usuRole: Rol asignado en el sistema (Admin, Estudiante, Guardia)
        public string usuRole { get; set; } = "Estudiante";

        // usuFacultad: Facultad de origen (FISEI, FCE, etc.)
        public string usuFacultad { get; set; } = "FISEI";

        // usuIsActive: Estado de actividad de la cuenta (activo/inactivo)
        public bool usuIsActive { get; set; } = true;

        // usuCreatedAt: Fecha de creación del registro
        public DateTime usuCreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// DTO para la petición de registro de nuevos usuarios.
    /// </summary>
    public class UserRegisterDto
    {
        public string usuNombre1 { get; set; } = string.Empty;
        public string? usuNombre2 { get; set; }
        public string usuApellido1 { get; set; } = string.Empty;
        public string? usuApellido2 { get; set; }
        public string usuEmail { get; set; } = string.Empty;
        public string usuPassword { get; set; } = string.Empty;
        public DateTime usuBirthDate { get; set; }
        public string usuFacultad { get; set; } = "FISEI";
    }

    /// <summary>
    /// DTO para la petición de autenticación de credenciales.
    /// </summary>
    public class UserLoginDto
    {
        public string usuEmail { get; set; } = string.Empty;
        public string usuPassword { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO de respuesta que incluye el Token de acceso JWT firmado e información del usuario.
    /// </summary>
    public class UserAuthResponseDto
    {
        public string usuToken { get; set; } = string.Empty;
        public string usuId { get; set; } = string.Empty;
        public string usuNombreCompleto { get; set; } = string.Empty;
        public string usuEmail { get; set; } = string.Empty;
        public string usuRole { get; set; } = string.Empty;
        public string usuFacultad { get; set; } = string.Empty;
    }
}
