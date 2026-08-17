using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.Domain.Entities;

public class PlanningSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "New Planning";
    public RotationDefinition Rotation { get; set; } = new RotationDefinition();
    public List<RestRule> RestRules { get; set; } = new()
    {
        new RestRule { Name = "Default", MinRestBetweenShifts = TimeSpan.FromHours(11), MinWeeklyRest = TimeSpan.FromHours(35) }
    };
    public List<Employee> Employees { get; set; } = new();
    public List<ShiftAssignment> Shifts { get; set; } = new();
}
