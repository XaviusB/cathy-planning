namespace CathyPlanning.Domain.ValueObjects;

public class RotationDefinition
{
    public int WeekCount { get; set; } = 6;
    public DateTime StartDate { get; set; } = DateTime.Today;

    public DateTime EndDate => StartDate.AddDays(WeekCount * 7);
}
