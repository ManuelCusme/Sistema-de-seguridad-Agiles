using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UtaSecurity.Services.Incidents.Controllers;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Models;
using Xunit;

namespace UtaSecurity.Services.Incidents.Tests
{
    public class TrustGroupsControllerTests
    {
        private readonly ApplicationDbContext _dbContext;

        public TrustGroupsControllerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new ApplicationDbContext(options);
        }

        private static T GetProperty<T>(object? obj, string propertyName)
        {
            if (obj == null) throw new ArgumentNullException(nameof(obj));
            var property = obj.GetType().GetProperty(propertyName);
            if (property == null)
            {
                throw new ArgumentException($"Property {propertyName} not found on type {obj.GetType().Name}");
            }
            return (T)property.GetValue(obj)!;
        }

        [Fact]
        public async Task Test_CreateGroup_Success()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var dto = new TrustGroupCreateDto
            {
                usuId = ownerId.ToString(),
                nombre = "Grupo de Respaldo"
            };

            // Act
            var result = await controller.CreateGroup(dto);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var success = GetProperty<bool>(okResult.Value, "success");
            var nombre = GetProperty<string>(okResult.Value, "nombre");

            Assert.True(success);
            Assert.Equal("Grupo de Respaldo", nombre);

            var group = await _dbContext.TrustGroups.FirstOrDefaultAsync(g => g.OwnerUserId == ownerId);
            Assert.NotNull(group);
            Assert.Equal("Grupo de Respaldo", group.Name);
            Assert.True(group.IsActive);
        }

        [Fact]
        public async Task Test_AddMember_And_GetGroups_Success()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var memberId = Guid.NewGuid();

            // Seed user directory
            _dbContext.UserDirectory.Add(new UserDirectoryEntity
            {
                Id = memberId,
                Nombre1 = "Juan",
                Apellido1 = "Perez",
                Email = "juan.perez@uta.edu.ec",
                IsActive = true
            });
            await _dbContext.SaveChangesAsync();

            // Create Group
            var group = new TrustGroupEntity
            {
                OwnerUserId = ownerId,
                Name = "Mi Grupo",
                IsActive = true
            };
            _dbContext.TrustGroups.Add(group);
            await _dbContext.SaveChangesAsync();

            // Act: Add Member
            var memberDto = new TrustGroupMemberDto
            {
                usuId = ownerId.ToString(),
                memberUserId = memberId.ToString()
            };
            var addResult = await controller.AddMember(group.Id, memberDto);

            // Assert Addition
            Assert.IsType<OkObjectResult>(addResult);

            // Act: Get Groups
            var getResult = await controller.GetGroups(ownerId.ToString());
            var okGetResult = Assert.IsType<OkObjectResult>(getResult);
            var groupsList = okGetResult.Value as IEnumerable<object>;
            Assert.NotNull(groupsList);
            Assert.Single(groupsList);
        }

        [Fact]
        public async Task Test_GetGroupsAsMember_Success()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var memberId = Guid.NewGuid();

            // Seed user directory for owner and member
            _dbContext.UserDirectory.AddRange(
                new UserDirectoryEntity { Id = ownerId, Nombre1 = "Owner", Apellido1 = "User", Email = "owner@uta.edu.ec", IsActive = true },
                new UserDirectoryEntity { Id = memberId, Nombre1 = "Member", Apellido1 = "User", Email = "member@uta.edu.ec", IsActive = true }
            );

            // Create Group owned by Owner
            var group = new TrustGroupEntity
            {
                OwnerUserId = ownerId,
                Name = "Grupo de Emergencias",
                IsActive = true
            };
            _dbContext.TrustGroups.Add(group);

            // Create membership
            var member = new TrustGroupMemberEntity
            {
                TrustGroupId = group.Id,
                MemberUserId = memberId,
                IsActive = true
            };
            _dbContext.TrustGroupMembers.Add(member);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await controller.GetGroupsAsMember(memberId.ToString());

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var list = okResult.Value as IEnumerable<object>;
            Assert.NotNull(list);
            Assert.Single(list);

            var firstItem = list.First();
            var pName = GetProperty<string>(firstItem, "nombre");
            var pOwner = GetProperty<string>(firstItem, "propietario");
            Assert.Equal("Grupo de Emergencias", pName);
            Assert.Equal("Owner User", pOwner);
        }

        [Fact]
        public async Task Test_CreateAndAcceptInvite_Success()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var memberId = Guid.NewGuid();

            _dbContext.UserDirectory.AddRange(
                new UserDirectoryEntity { Id = ownerId, Nombre1 = "Owner", Email = "owner@uta.edu.ec" },
                new UserDirectoryEntity { Id = memberId, Nombre1 = "Member", Email = "member@uta.edu.ec" }
            );

            var group = new TrustGroupEntity { OwnerUserId = ownerId, Name = "Grupo QR", IsActive = true };
            _dbContext.TrustGroups.Add(group);
            await _dbContext.SaveChangesAsync();

            // Act: Create Invite
            var inviteDto = new TrustGroupInviteCreateDto { usuId = ownerId.ToString(), expiresInMinutes = 15 };
            var inviteResult = await controller.CreateInvite(group.Id, inviteDto);
            var okInvite = Assert.IsType<OkObjectResult>(inviteResult);
            string token = GetProperty<string>(okInvite.Value, "token");

            // Act: Accept Invite
            var acceptDto = new TrustGroupInviteAcceptDto { usuId = memberId.ToString(), token = token };
            var acceptResult = await controller.AcceptInvite(acceptDto);

            // Assert Accept
            var okAccept = Assert.IsType<OkObjectResult>(acceptResult);
            var acceptSuccess = GetProperty<bool>(okAccept.Value, "success");
            Assert.True(acceptSuccess);

            // Verify member is in the database
            var memberExists = await _dbContext.TrustGroupMembers.AnyAsync(m => m.TrustGroupId == group.Id && m.MemberUserId == memberId && m.IsActive);
            Assert.True(memberExists);
        }

        [Fact]
        public async Task Test_RemoveMember_And_DeleteGroup_Success()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var memberId = Guid.NewGuid();

            var group = new TrustGroupEntity { OwnerUserId = ownerId, Name = "Grupo Temporal", IsActive = true };
            _dbContext.TrustGroups.Add(group);
            var member = new TrustGroupMemberEntity { TrustGroupId = group.Id, MemberUserId = memberId, IsActive = true };
            _dbContext.TrustGroupMembers.Add(member);
            await _dbContext.SaveChangesAsync();

            // Act: Remove Member
            var removeResult = await controller.RemoveMember(group.Id, member.Id, ownerId.ToString());
            Assert.IsType<OkObjectResult>(removeResult);
            var checkMember = await _dbContext.TrustGroupMembers.FindAsync(member.Id);
            Assert.False(checkMember!.IsActive);

            // Act: Delete Group
            var deleteResult = await controller.DeleteGroup(group.Id, ownerId.ToString());
            Assert.IsType<OkObjectResult>(deleteResult);
            var checkGroup = await _dbContext.TrustGroups.FindAsync(group.Id);
            Assert.False(checkGroup!.IsActive);
        }

        [Fact]
        public async Task Test_CreateGroup_NameTooLong_Fails()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var dto = new TrustGroupCreateDto
            {
                usuId = ownerId.ToString(),
                nombre = new string('A', 121) // 121 characters (exceeds limit 120)
            };

            // Act
            var result = await controller.CreateGroup(dto);

            // Assert
            var badResult = Assert.IsType<BadRequestObjectResult>(result);
            var success = GetProperty<bool>(badResult.Value, "success");
            var error = GetProperty<string>(badResult.Value, "error");
            Assert.False(success);
            Assert.Contains("no puede superar los 120 caracteres", error);
        }

        [Fact]
        public async Task Test_AddMember_AlreadyMember_Fails()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var memberId = Guid.NewGuid();

            // Seed user directory
            _dbContext.UserDirectory.Add(new UserDirectoryEntity
            {
                Id = memberId,
                Nombre1 = "Juan",
                Email = "juan@uta.edu.ec",
                IsActive = true
            });

            // Create Group and Member
            var group = new TrustGroupEntity { OwnerUserId = ownerId, Name = "Mi Grupo", IsActive = true };
            _dbContext.TrustGroups.Add(group);
            var member = new TrustGroupMemberEntity { TrustGroupId = group.Id, MemberUserId = memberId, IsActive = true };
            _dbContext.TrustGroupMembers.Add(member);
            await _dbContext.SaveChangesAsync();

            // Act: Try to add same member again
            var memberDto = new TrustGroupMemberDto
            {
                usuId = ownerId.ToString(),
                memberUserId = memberId.ToString()
            };
            var result = await controller.AddMember(group.Id, memberDto);

            // Assert
            var badResult = Assert.IsType<BadRequestObjectResult>(result);
            var error = GetProperty<string>(badResult.Value, "error");
            Assert.Contains("ya es miembro", error);
        }

        [Fact]
        public async Task Test_AcceptInvite_AlreadyMember_Fails()
        {
            // Arrange
            var controller = new TrustGroupsController(_dbContext);
            var ownerId = Guid.NewGuid();
            var memberId = Guid.NewGuid();

            _dbContext.UserDirectory.AddRange(
                new UserDirectoryEntity { Id = ownerId, Nombre1 = "Owner", Email = "owner@uta.edu.ec" },
                new UserDirectoryEntity { Id = memberId, Nombre1 = "Member", Email = "member@uta.edu.ec" }
            );

            var group = new TrustGroupEntity { OwnerUserId = ownerId, Name = "Grupo QR", IsActive = true };
            _dbContext.TrustGroups.Add(group);
            var member = new TrustGroupMemberEntity { TrustGroupId = group.Id, MemberUserId = memberId, IsActive = true };
            _dbContext.TrustGroupMembers.Add(member);
            await _dbContext.SaveChangesAsync();

            // Act: Create Invite
            var inviteDto = new TrustGroupInviteCreateDto { usuId = ownerId.ToString(), expiresInMinutes = 15 };
            var inviteResult = await controller.CreateInvite(group.Id, inviteDto);
            var okInvite = Assert.IsType<OkObjectResult>(inviteResult);
            string token = GetProperty<string>(okInvite.Value, "token");

            // Act: Accept Invite while already a member
            var acceptDto = new TrustGroupInviteAcceptDto { usuId = memberId.ToString(), token = token };
            var acceptResult = await controller.AcceptInvite(acceptDto);

            // Assert
            var badResult = Assert.IsType<BadRequestObjectResult>(acceptResult);
            var error = GetProperty<string>(badResult.Value, "error");
            Assert.Contains("Ya eres miembro", error);
        }
    }
}
