using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Domain.Services;
using CathyPlanning.Domain.ValueObjects;

namespace CathyPlanning.App.ViewModels;

public enum ReportPeriod { Day, Week, Month }

public class MainViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    private PlanningSession _session;
    private readonly ComplianceService _complianceService = new();
    private readonly PlannerService _plannerService = new();

    private string _complianceSummary = string.Empty;
    private string _hoursSummary = string.Empty;
    private DateTime _displayWeekStart;
    private ReportPeriod _selectedPeriod = ReportPeriod.Week;

    public MainViewModel()
    {
        _session = CreateDefaultSession();
        _displayWeekStart = _session.Rotation.StartDate;
        RefreshSummaries();
    }

    public PlanningSession Session => _session;

    public DateTime DisplayWeekStart
    {
        get => _displayWeekStart;
        set { _displayWeekStart = value; OnPropertyChanged(); OnPropertyChanged(nameof(WeekLabel)); }
    }

    public string WeekLabel =>
        $"Week of {_displayWeekStart:MMM dd, yyyy}  –  {_displayWeekStart.AddDays(6):MMM dd, yyyy}";

    public string HoursSummary
    {
        get => _hoursSummary;
        private set { _hoursSummary = value; OnPropertyChanged(); }
    }

    public string ComplianceSummary
    {
        get => _complianceSummary;
        private set { _complianceSummary = value; OnPropertyChanged(); }
    }

    public ReportPeriod SelectedPeriod
    {
        get => _selectedPeriod;
        set { _selectedPeriod = value; OnPropertyChanged(); RefreshSummaries(); }
    }

    /// <summary>Returns the (start, end) date range for the currently selected report period.</summary>
    public (DateTime Start, DateTime End) GetReportRange()
    {
        return _selectedPeriod switch
        {
            ReportPeriod.Day => (_displayWeekStart.Date, _displayWeekStart.Date.AddDays(1)),
            ReportPeriod.Month => (new DateTime(_displayWeekStart.Year, _displayWeekStart.Month, 1),
                                   new DateTime(_displayWeekStart.Year, _displayWeekStart.Month, 1).AddMonths(1)),
            _ => (_displayWeekStart, _displayWeekStart.AddDays(7)),
        };
    }

    public List<Employee> Employees => _session.Employees;

    public List<ShiftAssignment> ShiftsForWeek(DateTime weekStart)
    {
        var weekEnd = weekStart.AddDays(7);
        return _session.Shifts
            .Where(s => s.Start < weekEnd && s.End > weekStart)
            .ToList();
    }

    public void PreviousWeek()
    {
        DisplayWeekStart = DisplayWeekStart.AddDays(-7);
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void NextWeek()
    {
        DisplayWeekStart = DisplayWeekStart.AddDays(7);
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void GoToToday()
    {
        var today = DateTime.Today;
        // Monday of the current week (ISO: Mon = 1)
        var offset = ((int)today.DayOfWeek - 1 + 7) % 7;
        DisplayWeekStart = today.AddDays(-offset);
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    // Dummy prop to trigger calendar refresh
    public int ShiftsChangedMarker { get; private set; }

    public void MoveShift(ShiftAssignment shift, DateTime newStart)
    {
        var duration = shift.Duration;
        shift.Start = newStart;
        shift.End = newStart + duration;
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void ResizeShift(ShiftAssignment shift, DateTime newEnd)
    {
        if (newEnd > shift.Start.AddMinutes(30))
        {
            shift.End = newEnd;
            RefreshSummaries();
            OnPropertyChanged(nameof(ShiftsChangedMarker));
        }
    }

    public void AddShift(Guid employeeId, DateTime start, DateTime end, string label)
    {
        _session.Shifts.Add(new ShiftAssignment
        {
            EmployeeId = employeeId,
            Start = start,
            End = end,
            Label = label
        });
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void UpdateShift(Guid shiftId, Guid employeeId, DateTime start, DateTime end, string label)
    {
        var shift = _session.Shifts.FirstOrDefault(s => s.Id == shiftId);
        if (shift == null) return;
        shift.EmployeeId = employeeId;
        shift.Start = start;
        shift.End = end;
        shift.Label = label;
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void DeleteShift(Guid shiftId)
    {
        var shift = _session.Shifts.FirstOrDefault(s => s.Id == shiftId);
        if (shift != null) _session.Shifts.Remove(shift);
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void GeneratePlan()
    {
        _plannerService.GeneratePlan(_session);
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void LoadSession(PlanningSession session)
    {
        _session = session;
        _displayWeekStart = session.Rotation.StartDate;
        OnPropertyChanged(nameof(Session));
        OnPropertyChanged(nameof(Employees));
        OnPropertyChanged(nameof(WeekLabel));
        OnPropertyChanged(nameof(ShiftsChangedMarker));
        RefreshSummaries();
    }

    // --- Employee management ---

    public void AddEmployee(string name, string role, double maxWeeklyHours)
    {
        _session.Employees.Add(new Employee { Name = name, Role = role, MaxWeeklyHours = maxWeeklyHours });
        OnPropertyChanged(nameof(Employees));
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void RemoveEmployee(Guid id)
    {
        var emp = _session.Employees.FirstOrDefault(e => e.Id == id);
        if (emp == null) return;
        _session.Employees.Remove(emp);
        // Also remove the employee's shifts
        _session.Shifts.RemoveAll(s => s.EmployeeId == id);
        OnPropertyChanged(nameof(Employees));
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    public void UpdateEmployee(Guid id, string name, string role, double maxWeeklyHours)
    {
        var emp = _session.Employees.FirstOrDefault(e => e.Id == id);
        if (emp == null) return;
        emp.Name = name;
        emp.Role = role;
        emp.MaxWeeklyHours = maxWeeklyHours;
        OnPropertyChanged(nameof(Employees));
        RefreshSummaries();
        OnPropertyChanged(nameof(ShiftsChangedMarker));
    }

    // --- Summaries ---

    public void RefreshSummaries()
    {
        var (start, end) = GetReportRange();
        var report = _complianceService.EvaluateForPeriod(_session, start, end);

        var hours = string.Join("\n", report.HoursSummaries.Select(s =>
            $"{s.EmployeeName}: {s.TotalHours:F1}h / {s.MaxWeeklyHours}h ({s.PercentUsed:F0}%)"));

        HoursSummary = string.IsNullOrEmpty(hours) ? "No employees." : hours;

        if (!report.Violations.Any())
        {
            ComplianceSummary = "✅ No violations.";
        }
        else
        {
            ComplianceSummary = string.Join("\n", report.Violations.Select(v =>
                $"{(v.Severity == Domain.Services.ComplianceSeverity.Error ? "❌" : "⚠️")} {v.EmployeeName}: {v.Message}"));
        }
    }

    private static PlanningSession CreateDefaultSession()
    {
        var emp1 = new Employee { Name = "Alice", Role = "Nurse", MaxWeeklyHours = 40 };
        var emp2 = new Employee { Name = "Bob", Role = "Doctor", MaxWeeklyHours = 48 };

        return new PlanningSession
        {
            Name = "Demo Planning",
            Rotation = new RotationDefinition { WeekCount = 6, StartDate = DateTime.Today.AddDays(-(int)DateTime.Today.DayOfWeek + 1) },
            Employees = new List<Employee> { emp1, emp2 }
        };
    }
}
