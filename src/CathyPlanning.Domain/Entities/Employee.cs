namespace CathyPlanning.Domain.Entities;

public class Employee
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public double MaxWeeklyHours { get; set; } = 40.0;
}
