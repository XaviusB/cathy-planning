using System.Globalization;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.ValueObjects;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace CathyPlanning.Infrastructure.Persistence;

public class SessionRepository
{
    private static readonly ISerializer Serializer = new SerializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .Build();

    private static readonly IDeserializer Deserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    public void Save(PlanningSession session, string filePath)
    {
        var model = ToYamlModel(session);
        var yaml = Serializer.Serialize(model);
        File.WriteAllText(filePath, yaml);
    }

    public PlanningSession Load(string filePath)
    {
        var yaml = File.ReadAllText(filePath);
        var model = Deserializer.Deserialize<YamlPlanningFile>(yaml);
        return FromYamlModel(model);
    }

    private static YamlPlanningFile ToYamlModel(PlanningSession s) => new()
    {
        Version = 1,
        Id = s.Id.ToString(),
        Name = s.Name,
        Rotation = new YamlRotation
        {
            WeekCount = s.Rotation.WeekCount,
            StartDate = s.Rotation.StartDate.ToString("yyyy-MM-dd")
        },
        RestRules = s.RestRules.Select(r => new YamlRestRule
        {
            Name = r.Name,
            MinRestBetweenShiftsHours = r.MinRestBetweenShifts.TotalHours,
            MinWeeklyRestHours = r.MinWeeklyRest.TotalHours
        }).ToList(),
        Employees = s.Employees.Select(e => new YamlEmployee
        {
            Id = e.Id.ToString(),
            Name = e.Name,
            Role = e.Role,
            MaxWeeklyHours = e.MaxWeeklyHours,
            MinWeeklyRestHours = e.MinWeeklyRestHours
        }).ToList(),
        Shifts = s.Shifts.Select(sh => new YamlShift
        {
            Id = sh.Id.ToString(),
            EmployeeId = sh.EmployeeId.ToString(),
            Start = sh.Start.ToString("yyyy-MM-ddTHH:mm:ss"),
            End = sh.End.ToString("yyyy-MM-ddTHH:mm:ss"),
            Label = sh.Label
        }).ToList()
    };

    private static PlanningSession FromYamlModel(YamlPlanningFile m) => new()
    {
        Id = Guid.TryParse(m.Id, out var id) ? id : Guid.NewGuid(),
        Name = m.Name,
        Rotation = new RotationDefinition
        {
            WeekCount = m.Rotation.WeekCount,
            StartDate = DateTime.Parse(m.Rotation.StartDate, CultureInfo.InvariantCulture)
        },
        RestRules = m.RestRules.Select(r => new RestRule
        {
            Name = r.Name,
            MinRestBetweenShifts = TimeSpan.FromHours(r.MinRestBetweenShiftsHours),
            MinWeeklyRest = TimeSpan.FromHours(r.MinWeeklyRestHours)
        }).ToList(),
        Employees = m.Employees.Select(e => new Employee
        {
            Id = Guid.TryParse(e.Id, out var eid) ? eid : Guid.NewGuid(),
            Name = e.Name,
            Role = e.Role,
            MaxWeeklyHours = e.MaxWeeklyHours,
            MinWeeklyRestHours = e.MinWeeklyRestHours
        }).ToList(),
        Shifts = m.Shifts.Select(sh => new ShiftAssignment
        {
            Id = Guid.TryParse(sh.Id, out var sid) ? sid : Guid.NewGuid(),
            EmployeeId = Guid.TryParse(sh.EmployeeId, out var eid) ? eid : Guid.NewGuid(),
            Start = DateTime.ParseExact(sh.Start, "yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
            End = DateTime.ParseExact(sh.End, "yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
            Label = sh.Label
        }).ToList()
    };
}
