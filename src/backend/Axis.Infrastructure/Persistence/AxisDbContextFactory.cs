using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Axis.Infrastructure.Persistence;

public sealed class AxisDbContextFactory : IDesignTimeDbContextFactory<AxisDbContext>
{
    public AxisDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AxisDbContext>()
            .UseSqlite("Data Source=../../../data/axis.db")
            .Options;

        return new AxisDbContext(options);
    }
}
