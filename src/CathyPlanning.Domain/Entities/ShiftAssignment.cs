namespace CathyPlanning.Domain.Entities;

public class ShiftAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EmployeeId { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string? Label { get; set; }

    public TimeSpan Duration => End - Start;
}
