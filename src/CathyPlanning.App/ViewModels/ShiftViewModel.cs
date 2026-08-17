using System;
using Avalonia;
using Avalonia.Media;
using CathyPlanning.Domain.Entities;

namespace CathyPlanning.App.ViewModels;

public class ShiftViewModel
{
    public ShiftAssignment Assignment { get; }

    public ShiftViewModel(ShiftAssignment assignment)
    {
        Assignment = assignment;
    }

    public DateTime Start => Assignment.Start;
    public DateTime End => Assignment.End;
    public string Label => Assignment.Label ?? "Shift";
    public Guid EmployeeId => Assignment.EmployeeId;

    // Visual properties computed by CalendarView
    public double Left { get; set; }
    public double Top { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}
