using Axis.Application.Backup;
using Axis.Infrastructure.Backup;
using Axis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Axis.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddAxisInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var configuredConnectionString = configuration.GetConnectionString("Axis") ?? "Data Source=data/axis.db";
        var connectionString = new SqliteConnectionStringBuilder(configuredConnectionString)
        {
            ForeignKeys = true,
            Pooling = false,
            DefaultTimeout = 5
        }.ToString();

        services.AddDbContext<AxisDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<IAxisBackupService, AxisBackupService>();

        return services;
    }
}
