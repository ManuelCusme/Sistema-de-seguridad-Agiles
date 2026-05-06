-- ============================================================
-- SISTEMA DE SEGURIDAD UTA - Script de Base de Datos
-- Sprint 1 - Manuel Cusme
-- Sincronizado con Entities.cs
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'SeguridadUtaDB')
BEGIN
    CREATE DATABASE SeguridadUtaDB;
END
GO

USE SeguridadUtaDB;
GO

-- ============================================================
-- TABLA: Users (sincronizada con Entities.cs)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type = N'U')
BEGIN
    CREATE TABLE Users (
        Id            UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
        Nombre1       NVARCHAR(50)      NOT NULL,
        Nombre2       NVARCHAR(50)      NULL,
        Apellido1     NVARCHAR(50)      NOT NULL,
        Apellido2     NVARCHAR(50)      NULL,
        Email         NVARCHAR(100)     NOT NULL UNIQUE,
        PasswordHash  NVARCHAR(MAX)     NOT NULL,
        BirthDate     DATETIME          NOT NULL,
        Role          NVARCHAR(20)      NOT NULL DEFAULT 'Estudiante',
        Facultad      NVARCHAR(100)     NOT NULL DEFAULT 'FISEI',
        IsActive      BIT               NOT NULL DEFAULT 1,
        CreatedAt     DATETIME          NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Users creada correctamente.';
END
GO

-- ============================================================
-- TABLA: Geofences (zonas del campus)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Geofences]') AND type = N'U')
BEGIN
    CREATE TABLE Geofences (
        Id        UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
        Name      NVARCHAR(100)     NOT NULL,
        Latitude  FLOAT             NOT NULL,
        Longitude FLOAT             NOT NULL,
        Radius    FLOAT             NOT NULL  -- en metros
    );
    PRINT 'Tabla Geofences creada correctamente.';
END
GO

-- ============================================================
-- TABLA: Incidents (sincronizada con Entities.cs)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Incidents]') AND type = N'U')
BEGIN
    CREATE TABLE Incidents (
        Id           UNIQUEIDENTIFIER  PRIMARY KEY DEFAULT NEWID(),
        UserId       UNIQUEIDENTIFIER  NOT NULL REFERENCES Users(Id),
        Latitude     FLOAT             NOT NULL,
        Longitude    FLOAT             NOT NULL,
        GeofenceName NVARCHAR(100)     NULL,
        Motivo       NVARCHAR(100)     NOT NULL DEFAULT 'Emergencia',
        Timestamp    DATETIME          NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Incidents creada correctamente.';
END
GO

-- ============================================================
-- SEED: Zonas del campus Huachi (4 zonas operativas)
-- ============================================================
IF NOT EXISTS (SELECT * FROM Geofences WHERE Name = 'Zona1')
BEGIN
    INSERT INTO Geofences (Id, Name, Latitude, Longitude, Radius)
    VALUES
        (NEWID(), 'Zona1', -1.267490, -78.624756, 200),
        (NEWID(), 'Zona2', -1.267525, -78.623603, 200),
        (NEWID(), 'Zona3', -1.269470, -78.625026, 200),
        (NEWID(), 'Zona4', -1.269750, -78.623427, 200);
    PRINT '4 zonas del campus Huachi insertadas correctamente.';
END
GO

-- ============================================================
-- SEED: Usuarios de prueba (simulación DITIC)
-- Roles: Admin, Estudiante, Guardia
-- Passwords hasheadas con BCrypt (valor: 123456 / admin123)
-- NOTA: El backend (Program.cs) genera los hashes reales con
--       BCrypt.Net en el primer arranque. Este seed es solo
--       referencia para verificar la estructura.
-- ============================================================

-- 1 Administrador
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'admin@uta.edu.ec')
BEGIN
    INSERT INTO Users (Id, Nombre1, Apellido1, Email, PasswordHash, BirthDate, Role, Facultad)
    VALUES (NEWID(), 'Administrador', 'Central', 'admin@uta.edu.ec',
            'HASH_GENERADO_POR_BACKEND', '1990-01-01', 'Admin', 'DITIC');
END
GO

-- 5 Estudiantes
DECLARE @i INT = 1;
WHILE @i <= 5
BEGIN
    DECLARE @email NVARCHAR(100) = CONCAT('estudiante', @i, '@uta.edu.ec');
    IF NOT EXISTS (SELECT * FROM Users WHERE Email = @email)
    BEGIN
        INSERT INTO Users (Id, Nombre1, Apellido1, Email, PasswordHash, BirthDate, Role, Facultad)
        VALUES (NEWID(), 'Estudiante', CAST(@i AS NVARCHAR), @email,
                'HASH_GENERADO_POR_BACKEND', '2000-01-01', 'Estudiante', 'FISEI');
    END
    SET @i = @i + 1;
END
GO

-- 5 Guardias
DECLARE @j INT = 1;
WHILE @j <= 5
BEGIN
    DECLARE @emailG NVARCHAR(100) = CONCAT('guardia', @j, '@uta.edu.ec');
    IF NOT EXISTS (SELECT * FROM Users WHERE Email = @emailG)
    BEGIN
        INSERT INTO Users (Id, Nombre1, Apellido1, Email, PasswordHash, BirthDate, Role, Facultad)
        VALUES (NEWID(), 'Guardia', CAST(@j AS NVARCHAR), @emailG,
                'HASH_GENERADO_POR_BACKEND', '1985-01-01', 'Guardia', 'Seguridad');
    END
    SET @j = @j + 1;
END
GO

PRINT '================================================';
PRINT 'Base de datos SeguridadUtaDB lista.';
PRINT 'IMPORTANTE: Ejecuta el backend (dotnet run) para';
PRINT 'que los usuarios tengan sus hashes BCrypt reales.';
PRINT '================================================';
