# Create solution and projects
dotnet new sln -n TcpSocketSolution
dotnet new blazorserver -o TcpBlazorApp
dotnet new console -o TcpClientSample
dotnet sln add TcpBlazorApp/TcpBlazorApp.csproj
dotnet sln add TcpClientSample/TcpClientSample.csproj

# Write TcpBlazorApp/Program.cs
@'
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TcpBlazorApp.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();
builder.Services.AddSingleton<LogService>();
builder.Services.AddSingleton<TcpConnectionManager>();
builder.Services.AddHostedService<TcpServerService>();
var app = builder.Build();
if (!app.Environment.IsDevelopment()) app.UseExceptionHandler("/Error");
app.UseStaticFiles();
app.UseRouting();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");
app.Run();
'@ | Out-File -FilePath TcpBlazorApp/Program.cs -Encoding utf8

# TcpBlazorApp.csproj
@'
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
	<TargetFramework>net7.0</TargetFramework>
	<Nullable>enable</Nullable>
	<ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
'@ | Out-File -FilePath TcpBlazorApp/TcpBlazorApp.csproj -Encoding utf8

# Services folder
New-Item -ItemType Directory -Force -Path TcpBlazorApp/Services

# LogService.cs
@'
using System;
using System.Collections.Concurrent;

namespace TcpBlazorApp.Services
{
	public class LogService
	{
		private readonly ConcurrentQueue<string> _logs = new();
		public event Action? OnLog;
		public void Add(string line)
		{
			var timestamped = $"[{DateTime.Now:HH:mm:ss}] {line}";
			_logs.Enqueue(timestamped);
			while (_logs.Count > 1000) _logs.TryDequeue(out _);
			OnLog?.Invoke();
		}
		public string[] GetAll() => _logs.ToArray();
	}
}
'@ | Out-File -FilePath TcpBlazorApp/Services/LogService.cs -Encoding utf8

# TcpConnectionManager.cs
@'
using System.Net.Sockets;
using System.Collections.Concurrent;

namespace TcpBlazorApp.Services
{
	public class TcpConnectionManager
	{
		private readonly ConcurrentDictionary<string, TcpClient> _clients = new();
		public IEnumerable<string> GetClientIds() => _clients.Keys;
		public void Add(string id, TcpClient client) => _clients[id] = client;
		public void Remove(string id)
		{
			if (_clients.TryRemove(id, out var c)) try { c.Close(); } catch { }
		}
		public async Task BroadcastAsync(string message)
		{
			var buffer = System.Text.Encoding.UTF8.GetBytes(message + "\n");
			foreach (var kvp in _clients)
			{
				try { var stream = kvp.Value.GetStream(); await stream.WriteAsync(buffer, 0, buffer.Length); }
				catch { }
			}
		}
		public int Count => _clients.Count;
	}
}
'@ | Out-File -FilePath TcpBlazorApp/Services/TcpConnectionManager.cs -Encoding utf8

# TcpServerService.cs
@'
using Microsoft.Extensions.Hosting;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace TcpBlazorApp.Services
{
	public class TcpServerService : BackgroundService
	{
		private readonly LogService _log;
		private readonly TcpConnectionManager _connMgr;
		private readonly int _port = 9000;
		private TcpListener? _listener;

		public TcpServerService(LogService log, TcpConnectionManager connMgr)
		{
			_log = log; _connMgr = connMgr;
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			_listener = new TcpListener(IPAddress.Loopback, _port);
			_listener.Start();
			_log.Add($\"TCP server listening on 127.0.0.1:{_port}\");
			try
			{
				while (!stoppingToken.IsCancellationRequested)
				{
					var client = await _listener.AcceptTcpClientAsync(stoppingToken);
					_ = HandleClientAsync(client, stoppingToken);
				}
			}
			catch (OperationCanceledException) { }
			finally { _listener.Stop(); _log.Add(\"TCP listener stopped\"); }
		}

		private async Task HandleClientAsync(TcpClient client, CancellationToken cancellation)
		{
			var id = Guid.NewGuid().ToString()[..8];
			_connMgr.Add(id, client);
			_log.Add($\"Client connected: {id} ({client.Client.RemoteEndPoint})\");
			try
			{
				using var stream = client.GetStream();
				var reader = new StreamReader(stream, Encoding.UTF8);
				while (!cancellation.IsCancellationRequested)
				{
					var line = await reader.ReadLineAsync().WaitAsync(cancellation);
					if (line == null) break;
					_log.Add($\"[{id}] {line}\");
					if (line.StartsWith(\"ECHO \", StringComparison.OrdinalIgnoreCase))
					{
						var payload = line[5..];
						var bytes = Encoding.UTF8.GetBytes(payload + \"\\n\");
						await stream.WriteAsync(bytes, 0, bytes.Length, cancellation);
					}
					else if (line.Equals(\"QUIT\", StringComparison.OrdinalIgnoreCase)) break;
				}
			}
			catch (OperationCanceledException) { }
			catch (Exception ex) { _log.Add($\"Error client {id}: {ex.Message}\"); }
			finally { _connMgr.Remove(id); _log.Add($\"Client disconnected: {id}\"); }
		}

		public override Task StopAsync(CancellationToken cancellationToken)
		{
			_listener?.Stop();
			return base.StopAsync(cancellationToken);
		}
	}
}
'@ | Out-File -FilePath TcpBlazorApp/Services/TcpServerService.cs -Encoding utf8

# Pages and shared
New-Item -ItemType Directory -Force -Path TcpBlazorApp/Pages
New-Item -ItemType Directory -Force -Path TcpBlazorApp/Shared

# _Host.cshtml
@'
@page "/"
@namespace TcpBlazorApp.Pages
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TCP Blazor App</title>
  <base href="~/" />
  <link href="css/bootstrap/bootstrap.min.css" rel="stylesheet" />
</head>
<body>
  <app>
	<component type="typeof(App)" render-mode="ServerPrerendered" />
  </app>
  <script src="_framework/blazor.server.js"></script>
</body>
</html>
'@ | Out-File -FilePath TcpBlazorApp/Pages/_Host.cshtml -Encoding utf8

# _Imports.razor
@'
@using System.Net
@using System.Net.Sockets
@using TcpBlazorApp
@using TcpBlazorApp.Services
@using Microsoft.AspNetCore.Components
'@ | Out-File -FilePath TcpBlazorApp/_Imports.razor -Encoding utf8

# App.razor
@'
<Router AppAssembly="@typeof(App).Assembly">
  <Found Context="routeData">
	<RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
  </Found>
  <NotFound>
	<LayoutView Layout="@typeof(MainLayout)">
	  <p>Page not found</p>
	</LayoutView>
  </NotFound>
</Router>
'@ | Out-File -FilePath TcpBlazorApp/App.razor -Encoding utf8

# MainLayout.razor
@'
@inherits LayoutComponentBase
<div class="container-fluid px-3">
  <div class="row">
	<div class="col">@Body</div>
  </div>
</div>
'@ | Out-File -FilePath TcpBlazorApp/Shared/MainLayout.razor -Encoding utf8

# Index.razor
@'
@page "/"
@inject TcpBlazorApp.Services.LogService LogService
@inject TcpBlazorApp.Services.TcpConnectionManager ConnManager

<h3>TCP Server Dashboard</h3>
<p>Server listening on 127.0.0.1:9000</p>
<p>Connected clients: @ConnManager.Count</p>

<div class="mb-3">
  <input @bind="messageToBroadcast" class="form-control" placeholder="Message to broadcast" />
  <button class="btn btn-primary mt-2" @onclick="Broadcast">Broadcast</button>
</div>

<h5>Logs</h5>
<div style="height:400px;overflow:auto;border:1px solid #ddd;padding:8px;background:#fafafa" @ref="logDiv">
  @foreach (var line in logs) { <div>@line</div> }
</div>

@code {
  private string[] logs = Array.Empty<string>();
  private ElementReference logDiv;
  private string messageToBroadcast = "";

  protected override void OnInitialized()
  {
	logs = LogService.GetAll();
	LogService.OnLog += Refresh;
  }

  private void Refresh()
  {
	InvokeAsync(() =>
	{
	  logs = LogService.GetAll();
	  StateHasChanged();
	  _ = ScrollToBottom();
	});
  }

  private async Task ScrollToBottom()
  {
	await Task.Delay(50);
	try { await logDiv.FocusAsync(); } catch { }
  }

  private async Task Broadcast()
  {
	if (string.IsNullOrWhiteSpace(messageToBroadcast)) return;
	await ConnManager.BroadcastAsync(messageToBroadcast);
	LogService.Add($"[Server broadcast] {messageToBroadcast}");
	messageToBroadcast = "";
  }

  public void Dispose() => LogService.OnLog -= Refresh;
}
'@ | Out-File -FilePath TcpBlazorApp/Pages/Index.razor -Encoding utf8

# TcpClientSample csproj
@'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
	<OutputType>Exe</OutputType>
	<TargetFramework>net7.0</TargetFramework>
	<ImplicitUsings>enable</ImplicitUsings>
	<Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
'@ | Out-File -FilePath TcpClientSample/TcpClientSample.csproj -Encoding utf8

# TcpClientSample Program.cs
@'
using System.Net.Sockets;
using System.Text;

const string host = "127.0.0.1";
const int port = 9000;

using var client = new TcpClient();
Console.WriteLine($"Connecting to {host}:{port} ...");
await client.ConnectAsync(host, port);
Console.WriteLine("Connected. Type messages, or QUIT to exit. Prefix with ECHO to request echo.");

using var stream = client.GetStream();
var readTask = Task.Run(async () =>
{
	var reader = new StreamReader(stream, Encoding.UTF8);
	while (true)
	{
		string? line;
		try { line = await reader.ReadLineAsync(); }
		catch { break; }
		if (line == null) break;
		Console.WriteLine($"[Server] {line}");
	}
	Console.WriteLine("Server closed connection.");
});

while (true)
{
	var input = Console.ReadLine();
	if (input == null) break;
	var bytes = Encoding.UTF8.GetBytes(input + "\n");
	await stream.WriteAsync(bytes, 0, bytes.Length);
	if (input.Equals("QUIT", StringComparison.OrdinalIgnoreCase)) break;
}

Console.WriteLine("Closing client.");
client.Close();
'@ | Out-File -FilePath TcpClientSample/Program.cs -Encoding utf8

Write-Host 'Done. Open TcpSocketSolution.sln in Visual Studio or run: dotnet build'