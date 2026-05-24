using UtaSecurity.Services.Zones.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ZoneServiceCorsPolicy", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5000",
                "http://localhost:5173",
                "http://localhost:8081"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

builder.Services.AddSingleton<IZoneRepository, SqlZoneRepository>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var repository = scope.ServiceProvider.GetRequiredService<IZoneRepository>();
    await repository.EnsureReadyAsync();
}

app.UseCors("ZoneServiceCorsPolicy");
app.UseRouting();
app.UseAuthorization();

app.MapControllers();

app.Run();
