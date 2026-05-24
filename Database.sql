-- ============================================================
-- SISTEMA DE SEGURIDAD UTA - Script de Base de Datos
-- Sprint 1 - Manuel Cusme
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
-- TABLA: Users
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
        Code      NVARCHAR(10)      NOT NULL,
        Name      NVARCHAR(100)     NOT NULL,
            Boundary  GEOGRAPHY         NOT NULL,
            Latitude  FLOAT             NULL,
            Longitude FLOAT             NULL,
            Radius    FLOAT             NULL
    );
    PRINT 'Tabla Geofences creada correctamente.';
END
GO

IF COL_LENGTH('dbo.Geofences', 'Code') IS NULL
BEGIN
    ALTER TABLE Geofences ADD Code NVARCHAR(10) NULL;
END
GO

IF COL_LENGTH('dbo.Geofences', 'Boundary') IS NULL
BEGIN
    ALTER TABLE Geofences ADD Boundary GEOGRAPHY NULL;
END
GO

-- ============================================================
-- TABLA: Incidents
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
            Timestamp    DATETIME          NOT NULL DEFAULT GETDATE(),
            Status       NVARCHAR(20)      NOT NULL DEFAULT 'PENDIENTE',
            AssignedByUserId UNIQUEIDENTIFIER NULL,
            AssignedAt   DATETIME          NULL,
            ClosedByUserId UNIQUEIDENTIFIER NULL,
            ClosedAt     DATETIME          NULL,
            CloseObservation NVARCHAR(500)  NULL
    );
    PRINT 'Tabla Incidents creada correctamente.';
END
GO

    IF COL_LENGTH('dbo.Incidents', 'Status') IS NULL
    BEGIN
        ALTER TABLE Incidents ADD Status NVARCHAR(20) NOT NULL CONSTRAINT DF_Incidents_Status DEFAULT 'PENDIENTE';
    END
    GO

    IF COL_LENGTH('dbo.Incidents', 'AssignedByUserId') IS NULL
    BEGIN
        ALTER TABLE Incidents ADD AssignedByUserId UNIQUEIDENTIFIER NULL;
    END
    GO

    IF COL_LENGTH('dbo.Incidents', 'AssignedAt') IS NULL
    BEGIN
        ALTER TABLE Incidents ADD AssignedAt DATETIME NULL;
    END
    GO

    IF COL_LENGTH('dbo.Incidents', 'ClosedByUserId') IS NULL
    BEGIN
        ALTER TABLE Incidents ADD ClosedByUserId UNIQUEIDENTIFIER NULL;
    END
    GO

    IF COL_LENGTH('dbo.Incidents', 'ClosedAt') IS NULL
    BEGIN
        ALTER TABLE Incidents ADD ClosedAt DATETIME NULL;
    END
    GO

    IF COL_LENGTH('dbo.Incidents', 'CloseObservation') IS NULL
    BEGIN
        ALTER TABLE Incidents ADD CloseObservation NVARCHAR(500) NULL;
    END
    GO

-- ============================================================
-- SEED: Zonas del campus Huachi (4 zonas operativas)
-- ============================================================
IF NOT EXISTS (SELECT * FROM Geofences WHERE Boundary IS NOT NULL)
BEGIN
    INSERT INTO Geofences (Id, Code, Name, Boundary, Latitude, Longitude, Radius)
    VALUES
        (NEWID(), 'Z1', 'FACULTAD DE INGENIERÍA', geography::STPolyFromText('POLYGON ((-78.625301 -1.266416, -78.624212 -1.26648, -78.624212 -1.268564, -78.62584 -1.268564, -78.625301 -1.266416))', 4326), -1.267490, -78.624756, 200),
        (NEWID(), 'Z2', 'BIBLIOTECA GENERAL', geography::STPolyFromText('POLYGON ((-78.624212 -1.26648, -78.622994 -1.266555, -78.62264 -1.268564, -78.624212 -1.268564, -78.624212 -1.26648))', 4326), -1.267525, -78.623603, 200),
        (NEWID(), 'Z3', 'RECTORADO / ADMINISTRACIÓN', geography::STPolyFromText('POLYGON ((-78.62584 -1.268564, -78.624212 -1.268564, -78.624212 -1.27065, -78.62638 -1.270376, -78.62584 -1.268564))', 4326), -1.269470, -78.625026, 200),
        (NEWID(), 'Z4', 'COMPLEJO DEPORTIVO', geography::STPolyFromText('POLYGON ((-78.624212 -1.268564, -78.62264 -1.268564, -78.622289 -1.270935, -78.624212 -1.27065, -78.624212 -1.268564))', 4326), -1.269750, -78.623427, 200);
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
