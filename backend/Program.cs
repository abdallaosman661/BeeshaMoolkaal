using BeeshaMoolkaalApi.Services;

var builder = WebApplication.CreateBuilder(args);

// Mongo settings
builder.Services.Configure<MongoSettings>(builder.Configuration.GetSection("MongoSettings"));
builder.Services.AddSingleton<MongoDbService>();

// HttpClient used to call the upload sidecar
builder.Services.AddHttpClient();

// CORS so frontend/index.html (opened as a plain file or served separately) can call the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseCors("AllowFrontend");
app.UseStaticFiles(); // optional, in case you drop files into wwwroot
app.MapControllers();

app.MapGet("/", () => "Beesha Moolkaal API is running. Try GET /api/media");

app.Run();
