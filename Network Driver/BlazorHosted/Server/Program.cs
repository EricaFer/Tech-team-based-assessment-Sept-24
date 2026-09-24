using BlazorHosted.Shared;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseStaticFiles();
app.MapControllers();

app.Run();

// Simple controller placed here for minimal sample convenience
[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    [HttpGet]
    public ActionResult<IEnumerable<Message>> Get()
    {
        return Ok(new[] { new Message { Text = "Hello from server", Timestamp = DateTime.UtcNow } });
    }

    [HttpPost]
    public ActionResult<Message> Post([FromBody] Message message)
    {
        if (message == null || string.IsNullOrWhiteSpace(message.Text))
            return BadRequest();

        var echoed = new Message { Text = "Echo: " + message.Text, Timestamp = DateTime.UtcNow };
        return Ok(echoed);
    }
}
