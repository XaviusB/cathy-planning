namespace CathyPlanning.Domain.Services;

public enum ComplianceSeverity { Ok, Warning, Error }

public class ComplianceViolation
{
    public Guid EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public ComplianceSeverity Severity { get; init; }
    public string Message { get; init; } = string.Empty;
}

public class EmployeeHoursSummary
{
    public Guid EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public double TotalHours { get; init; }
    public double MaxWeeklyHours { get; init; }
}

public class ComplianceReport
{
    public List<ComplianceViolation> Violations { get; init; } = new();
    public List<EmployeeHoursSummary> HoursSummaries { get; init; } = new();
    public bool IsCompliant => Violations.All(v => v.Severity != ComplianceSeverity.Error);
}
