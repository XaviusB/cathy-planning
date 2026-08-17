namespace CathyPlanning.Domain.ValueObjects;

public class RestRule
{
    public string Name { get; set; } = string.Empty;
    public TimeSpan MinRestBetweenShifts { get; set; } = TimeSpan.FromHours(11);
    public TimeSpan MinWeeklyRest { get; set; } = TimeSpan.FromHours(35);
}
