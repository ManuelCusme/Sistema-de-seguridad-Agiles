using System;
using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using UtaSecurity.Services.Incidents.Controllers;
using UtaSecurity.Services.Incidents.Data;
using UtaSecurity.Services.Incidents.Hubs;
using UtaSecurity.Services.Incidents.Models;
using Xunit;

namespace UtaSecurity.Services.Incidents.Tests
{
    public class IncidentsControllerTests
    {
        private readonly Mock<IHubContext<AlertHub>> _mockHubContext;
        private readonly Mock<IClientProxy> _mockClientProxy;
        private readonly Mock<IHttpClientFactory> _mockHttpClientFactory;
        private readonly Mock<ILogger<IncidentsController>> _mockLogger;
        private readonly ApplicationDbContext _dbContext;

        public IncidentsControllerTests()
        {
            _mockHubContext = new Mock<IHubContext<AlertHub>>();
            var mockHubClients = new Mock<IHubClients>();
            _mockClientProxy = new Mock<IClientProxy>();
            
            mockHubClients.Setup(clients => clients.All).Returns(_mockClientProxy.Object);
            _mockHubContext.Setup(hub => hub.Clients).Returns(mockHubClients.Object);

            _mockHttpClientFactory = new Mock<IHttpClientFactory>();
            _mockLogger = new Mock<ILogger<IncidentsController>>();

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new ApplicationDbContext(options);
        }

        private HttpClient CreateMockHttpClient(HttpStatusCode statusCode, string content, int delayMs = 0)
        {
            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock
               .Protected()
               .Setup<Task<HttpResponseMessage>>(
                  "SendAsync",
                  ItExpr.IsAny<HttpRequestMessage>(),
                  ItExpr.IsAny<CancellationToken>()
               )
               .Returns(async () =>
               {
                   if (delayMs > 0) await Task.Delay(delayMs);
                   return new HttpResponseMessage
                   {
                       StatusCode = statusCode,
                       Content = new StringContent(content)
                   };
               })
               .Verifiable();

            return new HttpClient(handlerMock.Object)
            {
                BaseAddress = new Uri("http://localhost:5004/")
            };
        }

        [Fact]
        public async Task Test_ZonaAsignadaCorrectamente_CuandoGPSDisponible()
        {
            // Arrange
            var httpClient = CreateMockHttpClient(HttpStatusCode.OK, "\"Ingeniería\"");
            _mockHttpClientFactory.Setup(f => f.CreateClient("ZoneService")).Returns(httpClient);

            var controller = new IncidentsController(_mockHubContext.Object, _dbContext, _mockHttpClientFactory.Object, _mockLogger.Object);

            var dto = new IncidentDto
            {
                incLatitud = -1.23,
                incLongitud = -78.45,
                incUsuarioId = Guid.NewGuid().ToString()
            };

            // Act
            var result = await controller.PostIncident(dto);

            // Assert
            Assert.IsType<OkObjectResult>(result);
            
            var savedIncident = await _dbContext.Incidents.FirstOrDefaultAsync();
            Assert.NotNull(savedIncident);
            Assert.Equal("Ingeniería", savedIncident.Zona);
        }

        [Fact]
        public async Task Test_ZonaNoDisponible_CuandoGPSDesactivado()
        {
            // Arrange
            var httpClient = CreateMockHttpClient(HttpStatusCode.OK, "\"Ingeniería\"");
            _mockHttpClientFactory.Setup(f => f.CreateClient("ZoneService")).Returns(httpClient);

            var controller = new IncidentsController(_mockHubContext.Object, _dbContext, _mockHttpClientFactory.Object, _mockLogger.Object);

            var dto = new IncidentDto
            {
                incLatitud = 0,
                incLongitud = 0,
                incUsuarioId = Guid.NewGuid().ToString()
            };

            // Act
            var result = await controller.PostIncident(dto);

            // Assert
            Assert.IsType<OkObjectResult>(result);

            var savedIncident = await _dbContext.Incidents.FirstOrDefaultAsync();
            Assert.NotNull(savedIncident);
            Assert.Equal("No disponible", savedIncident.Zona);

            _mockLogger.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v != null && v.ToString()!.Contains("Alerta recibida sin coordenadas GPS")),
                    It.IsAny<Exception>(),
                    It.Is<Func<It.IsAnyType, Exception?, string>>((v, t) => true)),
                Times.Once);
        }

        [Fact]
        public async Task Test_ZonaNoDisponible_CuandoMSCFalla()
        {
            // Arrange
            var httpClient = CreateMockHttpClient(HttpStatusCode.InternalServerError, "");
            _mockHttpClientFactory.Setup(f => f.CreateClient("ZoneService")).Returns(httpClient);

            var controller = new IncidentsController(_mockHubContext.Object, _dbContext, _mockHttpClientFactory.Object, _mockLogger.Object);

            var dto = new IncidentDto
            {
                incLatitud = -1.23,
                incLongitud = -78.45,
                incUsuarioId = Guid.NewGuid().ToString()
            };

            // Act
            var result = await controller.PostIncident(dto);

            // Assert
            Assert.IsType<OkObjectResult>(result);

            var savedIncident = await _dbContext.Incidents.FirstOrDefaultAsync();
            Assert.NotNull(savedIncident);
            Assert.Equal("No disponible", savedIncident.Zona);
        }

        [Fact]
        public async Task Test_TiempoRespuesta_MenorA500ms()
        {
            // Arrange
            var httpClient = CreateMockHttpClient(HttpStatusCode.OK, "\"Ingeniería\"", delayMs: 200);
            _mockHttpClientFactory.Setup(f => f.CreateClient("ZoneService")).Returns(httpClient);

            var controller = new IncidentsController(_mockHubContext.Object, _dbContext, _mockHttpClientFactory.Object, _mockLogger.Object);

            var dto = new IncidentDto
            {
                incLatitud = -1.23,
                incLongitud = -78.45,
                incUsuarioId = Guid.NewGuid().ToString()
            };

            var stopwatch = new Stopwatch();

            // Act
            stopwatch.Start();
            var result = await controller.PostIncident(dto);
            stopwatch.Stop();

            // Assert
            Assert.IsType<OkObjectResult>(result);
            Assert.True(stopwatch.ElapsedMilliseconds < 500, $"El tiempo fue de {stopwatch.ElapsedMilliseconds}ms, que es mayor a 500ms.");
        }
    }
}
