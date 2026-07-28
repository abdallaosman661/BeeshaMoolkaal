using BeeshaMoolkaalApi.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace BeeshaMoolkaalApi.Services;

public class MongoDbService
{
    public IMongoCollection<MediaFile> MediaFiles { get; }

    public MongoDbService(IOptions<MongoSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);
        MediaFiles = database.GetCollection<MediaFile>("MediaFiles");
    }
}
