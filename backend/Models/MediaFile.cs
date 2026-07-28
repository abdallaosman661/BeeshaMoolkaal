using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BeeshaMoolkaalApi.Models;

public class MediaFile
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string FileName { get; set; } = string.Empty;

    // "image" or "video"
    public string FileType { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    // Public URL returned by the upload sidecar (UploadThing)
    public string FileUrl { get; set; } = string.Empty;

    // UploadThing's internal file key - needed to delete the file later
    public string FileKey { get; set; } = string.Empty;

    public long FileSize { get; set; }

    public string? Title { get; set; }

    public string? Description { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
