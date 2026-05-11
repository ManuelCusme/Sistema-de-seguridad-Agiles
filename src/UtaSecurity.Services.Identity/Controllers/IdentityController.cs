// IDENTITYCONTROLLER.CS — ENDPOINT DE REGISTRO Y AUTENTICACIÓN JWT CON BCRYPT
// Microservicio: UtaSecurity.Services.Identity
// Responsable: Emilio Abril (EMILIOABRIL05)

using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using UtaSecurity.Services.Identity.Models;
using UtaSecurity.Services.Identity.Data;
using Microsoft.EntityFrameworkCore;

namespace UtaSecurity.Services.Identity.Controllers
{
    /// <summary>
    /// Controlador centralizado para gestionar el registro, login y generación de tokens JWT.
    /// Resuelve las rutas de /api/identity/login y /api/identity/register necesarias para el flujo del Gateway.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class IdentityController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private static bool _seeded = false;
        private const string SecretKey = "SuperSecretSecurityKeyForUtaSecuritySystem2026"; 

        public IdentityController(ApplicationDbContext context)
        {
            _context = context;
            if (!_seeded)
            {
                SeedUsers();
                _seeded = true;
            }
        }

        /// <summary>
        /// Registra un nuevo usuario en la simulación, aplicando validaciones de edad obligatorias (> 13 años)
        /// y encriptando contraseñas utilizando BCrypt.
        /// </summary>
        [HttpPost("register")]
        public IActionResult Register([FromBody] UserRegisterDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { error = "Los datos del registro son requeridos." });
            }

            if (string.IsNullOrEmpty(dto.usuEmail) || string.IsNullOrEmpty(dto.usuPassword))
            {
                return BadRequest(new { error = "El correo (usuEmail) y la contraseña (usuPassword) son obligatorios." });
            }

            // Validar si el correo institucional ya se encuentra en uso
            if (_context.Users.Any(u => u.usuEmail == dto.usuEmail))
            {
                return BadRequest(new { error = "El correo electrónico institucional ya se encuentra registrado." });
            }

            // Validar restricción obligatoria de edad (> 13 años)
            var edad = DateTime.UtcNow.Year - dto.usuBirthDate.Year;
            if (dto.usuBirthDate > DateTime.UtcNow.AddYears(-edad)) edad--;
            if (edad < 13)
            {
                return BadRequest(new { error = "La validación de edad falló. La edad mínima requerida para registro es de 13 años." });
            }

            var nuevoUsuario = new UserEntity
            {
                usuId = Guid.NewGuid(),
                usuNombre1 = dto.usuNombre1,
                usuNombre2 = dto.usuNombre2,
                usuApellido1 = dto.usuApellido1,
                usuApellido2 = dto.usuApellido2,
                usuEmail = dto.usuEmail,
                usuPasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.usuPassword), // Hasheo seguro
                usuBirthDate = dto.usuBirthDate,
                usuRole = "Estudiante", // Rol predeterminado para estudiantes registrados
                usuFacultad = dto.usuFacultad,
                usuIsActive = true,
                usuCreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(nuevoUsuario);
            _context.SaveChanges();

            return Ok(new
            {
                mensaje = "Usuario registrado exitosamente en el sistema de seguridad.",
                usuario = new
                {
                    usuId = nuevoUsuario.usuId.ToString(),
                    nuevoUsuario.usuEmail,
                    nuevoUsuario.usuNombre1,
                    nuevoUsuario.usuApellido1,
                    nuevoUsuario.usuRole,
                    nuevoUsuario.usuFacultad
                }
            });
        }

        /// <summary>
        /// Autentica las credenciales con BCrypt y genera un Token JWT firmado de 7 días.
        /// Retorna el token e información detallada de claims del usuario para consumo en móvil y web.
        /// </summary>
        [HttpPost("login")]
        public IActionResult Login([FromBody] UserLoginDto dto)
        {
            if (dto == null || string.IsNullOrEmpty(dto.usuEmail) || string.IsNullOrEmpty(dto.usuPassword))
            {
                return BadRequest(new { error = "El correo (usuEmail) y la contraseña (usuPassword) son requeridos." });
            }

            // Buscar usuario
            var usuario = _context.Users.FirstOrDefault(u => u.usuEmail == dto.usuEmail);
            if (usuario == null || !BCrypt.Net.BCrypt.Verify(dto.usuPassword, usuario.usuPasswordHash))
            {
                return Unauthorized(new { error = "Credenciales incorrectas. Verifique el correo o contraseña." });
            }

            if (!usuario.usuIsActive)
            {
                return BadRequest(new { error = "La cuenta se encuentra actualmente desactivada en el sistema." });
            }

            // --- GENERACIÓN DE TOKEN JWT FIRMADO ---
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(SecretKey);
            var nombreCompleto = $"{usuario.usuNombre1} {usuario.usuApellido1}".Trim();

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, usuario.usuId.ToString()),
                    new Claim(ClaimTypes.Email, usuario.usuEmail),
                    new Claim(ClaimTypes.Role, usuario.usuRole),
                    new Claim("NombreCompleto", nombreCompleto),
                    new Claim("Facultad", usuario.usuFacultad)
                }),
                Expires = DateTime.UtcNow.AddDays(7), // Expira en 7 días para desarrollo móvil
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            // Retornar DTO estructurado para Mobile / Web
            return Ok(new UserAuthResponseDto
            {
                usuToken = tokenString,
                usuId = usuario.usuId.ToString(),
                usuNombreCompleto = nombreCompleto,
                usuEmail = usuario.usuEmail,
                usuRole = usuario.usuRole,
                usuFacultad = usuario.usuFacultad
            });
        }

        /// <summary>
        /// Endpoint auxiliar para listar usuarios cargados (útil para auditoría rápida en desarrollo).
        /// </summary>
        [HttpGet("users")]
        public IActionResult GetUsers()
        {
            var publicList = _context.Users.Select(u => new
            {
                usuId = u.usuId.ToString(),
                u.usuNombre1,
                u.usuApellido1,
                u.usuEmail,
                u.usuRole,
                u.usuFacultad,
                u.usuIsActive
            });
            return Ok(publicList);
        }

        /// <summary>
        /// Sembrar los 11 usuarios institucionales indicados en GUIAPROYECTO.md
        /// </summary>
        private void SeedUsers()
        {
            // 1. Administrador Central
            if (!_context.Users.Any(u => u.usuEmail == "admin@uta.edu.ec"))
            {
                _context.Users.Add(new UserEntity
                {
                    usuId = Guid.NewGuid(),
                    usuNombre1 = "Administrador",
                    usuApellido1 = "Central",
                    usuEmail = "admin@uta.edu.ec",
                    usuPasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    usuRole = "Admin",
                    usuFacultad = "DITIC"
                });
            }

            // 2. 5 Estudiantes (FISEI)
            for (int i = 1; i <= 5; i++)
            {
                string email = $"estudiante{i}@uta.edu.ec";
                if (!_context.Users.Any(u => u.usuEmail == email))
                {
                    _context.Users.Add(new UserEntity
                    {
                        usuId = Guid.NewGuid(),
                        usuNombre1 = "Estudiante",
                        usuApellido1 = i.ToString(),
                        usuEmail = email,
                        usuPasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                        usuRole = "Estudiante",
                        usuFacultad = "FISEI"
                    });
                }
            }

            // 3. 5 Guardias (Seguridad)
            for (int i = 1; i <= 5; i++)
            {
                string email = $"guardia{i}@uta.edu.ec";
                if (!_context.Users.Any(u => u.usuEmail == email))
                {
                    _context.Users.Add(new UserEntity
                    {
                        usuId = Guid.NewGuid(),
                        usuNombre1 = "Guardia",
                        usuApellido1 = i.ToString(),
                        usuEmail = email,
                        usuPasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                        usuRole = "Guardia",
                        usuFacultad = "Seguridad"
                    });
                }
            }
            _context.SaveChanges();
        }
    }
}
