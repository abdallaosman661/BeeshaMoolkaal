using BeeshaMoolkaalApi.Models;
using BeeshaMoolkaalApi.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace BeeshaMoolkaalApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly MongoDbService _mongo;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _sidecarUrl;

    public MediaController(MongoDbService mongo, IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _mongo = mongo;
        _httpClientFactory = httpClientFactory;
        _sidecarUrl = config["UploadSidecarUrl"] ?? "http://localhost:4000";
    }

    // POST /api/media/upload
    [HttpPost("upload")]
    [RequestSizeLimit(200_000_000)] // 200 MB, adjust for video uploads as needed
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string title, [FromForm] string? description)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        if (string.IsNullOrWhiteSpace(title))
            return BadRequest(new { message = "Title is required." });

        var allowedTypes = new[] { "image/", "video/" };
        if (!allowedTypes.Any(t => file.ContentType.StartsWith(t)))
            return BadRequest(new { message = "Only image or video files are allowed." });

        UploadThingResult? sidecarResult;
        try
        {
            using var content = new MultipartFormDataContent();
            using var stream = file.OpenReadStream();
            var streamContent = new StreamContent(stream);
            streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(file.ContentType);
            content.Add(streamContent, "file", file.FileName);

            var client = _httpClientFactory.CreateClient();
            var response = await client.PostAsync($"{_sidecarUrl}/upload", content);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Upload sidecar error", details = errorBody });
            }

            sidecarResult = await response.Content.ReadFromJsonAsync<UploadThingResult>();
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { message = "Could not reach upload sidecar. Is it running on " + _sidecarUrl + "?", error = ex.Message });
        }

        if (sidecarResult == null)
            return StatusCode(500, new { message = "Upload sidecar returned an empty response." });

        var media = new MediaFile
        {
            FileName = file.FileName,
            FileType = file.ContentType.StartsWith("video") ? "video" : "image",
            ContentType = file.ContentType,
            FileUrl = sidecarResult.Url,
            FileKey = sidecarResult.Key,
            FileSize = file.Length,
            Title = title,
            Description = description
        };

        try
        {
            await _mongo.MediaFiles.InsertOneAsync(media);
        }
        catch (MongoDB.Driver.MongoException ex)
        {
            return StatusCode(500, new
            {
                message = "File uploaded to storage, but saving to MongoDB failed. Check your connection string and Atlas Network Access allowlist.",
                error = ex.Message
            });
        }

        return Ok(media);
    }

    // POST /api/media/link — for YouTube video links (no file upload involved)
    [HttpPost("link")]
    public async Task<IActionResult> AddVideoLink([FromBody] VideoLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Title is required." });

        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(new { message = "Video URL is required." });

        var media = new MediaFile
        {
            FileName = request.Title,
            FileType = "video",
            ContentType = "video/link",
            FileUrl = request.VideoUrl,
            FileKey = string.Empty,
            FileSize = 0,
            Title = request.Title,
            Description = request.Description
        };

        try
        {
            await _mongo.MediaFiles.InsertOneAsync(media);
        }
        catch (MongoDB.Driver.MongoException ex)
        {
            return StatusCode(500, new
            {
                message = "Could not save to MongoDB. Check your connection string and Atlas Network Access allowlist.",
                error = ex.Message
            });
        }

        return Ok(media);
    }

    // GET /api/media
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var files = await _mongo.MediaFiles
                .Find(_ => true)
                .SortByDescending(m => m.UploadedAt)
                .ToListAsync();

            return Ok(files);
        }
        catch (MongoDB.Driver.MongoException ex)
        {
            return StatusCode(500, new
            {
                message = "Could not reach MongoDB. Check your connection string and Atlas Network Access allowlist.",
                error = ex.Message
            });
        }
    }

    // DELETE /api/media/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var media = await _mongo.MediaFiles.Find(m => m.Id == id).FirstOrDefaultAsync();
        if (media == null)
            return NotFound(new { message = "Media not found." });

        try
        {
            var client = _httpClientFactory.CreateClient();
            await client.PostAsJsonAsync($"{_sidecarUrl}/delete", new { key = media.FileKey });
        }
        catch (HttpRequestException)
        {
            // Even if the sidecar/UploadThing call fails, we still remove the DB record
            // so the app doesn't get stuck. Log this in a real project.
        }

        await _mongo.MediaFiles.DeleteOneAsync(m => m.Id == id);
        return NoContent();
    }
}

public class UploadThingResult
{
    public string Key { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public long Size { get; set; }
}

public class VideoLinkRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string VideoUrl { get; set; } = string.Empty;
}
