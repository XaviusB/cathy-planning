using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.Infrastructure.Persistence;

// Flat YAML-serializable model (avoids Guid/TimeSpan serialization quirks)
public class YamlPlanningFile
{
    public int Version { get; set; } = 1;
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "New Planning";
    public YamlRotation Rotation { get; set; } = new();
    public List<YamlRestRule> RestRules { get; set; } = new();
    public List<YamlEmployee> Employees { get; set; } = new();
    public List<YamlShift> Shifts { get; set; } = new();
}

public class YamlRotation
{
    public int WeekCount { get; set; } = 6;
    public string StartDate { get; set; } = DateTime.Today.ToString("yyyy-MM-dd");
}

public class YamlRestRule
{
    public string Name { get; set; } = string.Empty;
    public double MinRestBetweenShiftsHours { get; set; } = 11;
    public double MinWeeklyRestHours { get; set; } = 35;
}

public class YamlEmployee
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public double MaxWeeklyHours { get; set; } = 40;
    public double? MinWeeklyRestHours { get; set; }
}

public class YamlShift
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string EmployeeId { get; set; } = string.Empty;
    public string Start { get; set; } = string.Empty;
    public string End { get; set; } = string.Empty;
    public string? Label { get; set; }
}
