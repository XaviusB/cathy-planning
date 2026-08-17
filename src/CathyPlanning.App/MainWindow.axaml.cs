using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Platform.Storage;
using CathyPlanning.App.ViewModels;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Infrastructure.Persistence;

namespace CathyPlanning.App;

public partial class MainWindow : Window
{
    private MainViewModel _vm = new();
    private readonly SessionRepository _repo = new();

    // Layout constants
    private const double HeaderHeight = 36;
    private const double RowHeaderWidth = 100;
    private const double HourHeight = 40;   // pixels per hour (24h per row)
    private const double MinCellWidth = 60;

    // Drag state
    private Border? _draggingBlock;
    private ShiftAssignment? _draggingShift;
    private Point _dragOffset;
    private bool _isResizing;
    private double _blockOriginalHeight;
    private double _blockOriginalTop;

    public MainWindow()
    {
        InitializeComponent();
        WireButtons();
        DrawCalendar();
    }

    private void WireButtons()
    {
        this.FindControl<Button>("BtnNew")!.Click += (_, _) => { _vm = new MainViewModel(); DrawCalendar(); };
        this.FindControl<Button>("BtnOpen")!.Click += async (_, _) =>
        {
            var files = await StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
            {
                Title = "Open Planning Session",
                AllowMultiple = false,
                FileTypeFilter = new[] { new FilePickerFileType("YAML") { Patterns = new[] { "*.yaml", "*.yml" } } }
            });
            if (files.Count > 0)
            {
                var path = files[0].TryGetLocalPath();
                if (path != null)
                {
                    try { _vm.LoadSession(_repo.Load(path)); DrawCalendar(); }
                    catch (Exception ex) { await ShowError(ex.Message); }
                }
            }
        };
        this.FindControl<Button>("BtnSave")!.Click += async (_, _) =>
        {
            var file = await StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions
            {
                Title = "Save Planning Session",
                DefaultExtension = "yaml",
                FileTypeChoices = new[] { new FilePickerFileType("YAML") { Patterns = new[] { "*.yaml" } } }
            });
            if (file != null)
            {
                var path = file.TryGetLocalPath();
                if (path != null)
                {
                    try { _repo.Save(_vm.Session, path); }
                    catch (Exception ex) { await ShowError(ex.Message); }
                }
            }
        };
        this.FindControl<Button>("BtnGenerate")!.Click += (_, _) => { _vm.GeneratePlan(); DrawCalendar(); };
        this.FindControl<Button>("BtnPrev")!.Click += (_, _) => { _vm.PreviousWeek(); DrawCalendar(); };
        this.FindControl<Button>("BtnNext")!.Click += (_, _) => { _vm.NextWeek(); DrawCalendar(); };

        SizeChanged += (_, _) => DrawCalendar();
    }

    private void DrawCalendar()
    {
        var canvas = CalendarCanvas;
        canvas.Children.Clear();

        TxtWeekLabel.Text = _vm.WeekLabel;
        TxtHours.Text = _vm.HoursSummary;
        TxtCompliance.Text = _vm.ComplianceSummary;

        var canvasWidth = canvas.Bounds.Width > 0 ? canvas.Bounds.Width : 1100;
        var gridWidth = canvasWidth - RowHeaderWidth;
        var dayWidth = Math.Max(MinCellWidth, gridWidth / 7.0);

        var employees = _vm.Employees;
        var rowHeight = HourHeight * 24;

        // Background
        canvas.Background = Brushes.White;

        // Day header
        for (int d = 0; d < 7; d++)
        {
            var day = _vm.DisplayWeekStart.AddDays(d);
            var x = RowHeaderWidth + d * dayWidth;
            DrawRect(canvas, x, 0, dayWidth - 1, HeaderHeight,
                day.Date == DateTime.Today.Date ? new SolidColorBrush(Color.Parse("#D0E8FF")) : new SolidColorBrush(Color.Parse("#E8EDF2")));
            DrawText(canvas, day.ToString("ddd\ndd"), x + 4, 4, 11, Brushes.Black, dayWidth - 8);

            // Vertical grid line
            DrawLine(canvas, x, 0, x, HeaderHeight + employees.Count * rowHeight, new SolidColorBrush(Color.Parse("#CCC")));
        }
        // Last vertical line
        DrawLine(canvas, RowHeaderWidth + 7 * dayWidth, 0, RowHeaderWidth + 7 * dayWidth, HeaderHeight + employees.Count * rowHeight, new SolidColorBrush(Color.Parse("#CCC")));

        // Employee rows
        for (int e = 0; e < employees.Count; e++)
        {
            var emp = employees[e];
            var rowY = HeaderHeight + e * rowHeight;

            // Row header
            DrawRect(canvas, 0, rowY, RowHeaderWidth - 1, rowHeight, new SolidColorBrush(Color.Parse("#F4F7FA")));
            DrawText(canvas, emp.Name, 4, rowY + 4, 11, Brushes.Black, RowHeaderWidth - 8);

            // Hour lines
            for (int h = 0; h <= 24; h++)
            {
                var lineY = rowY + h * HourHeight;
                DrawLine(canvas, RowHeaderWidth, lineY, RowHeaderWidth + 7 * dayWidth, lineY,
                    h % 4 == 0 ? new SolidColorBrush(Color.Parse("#DDD")) : new SolidColorBrush(Color.Parse("#F0F0F0")));
                if (h < 24 && h % 4 == 0)
                    DrawText(canvas, $"{h:00}:00", 2, lineY + 1, 9, new SolidColorBrush(Color.Parse("#888")), RowHeaderWidth - 4);
            }

            // Row separator
            DrawLine(canvas, 0, rowY + rowHeight, RowHeaderWidth + 7 * dayWidth, rowY + rowHeight, new SolidColorBrush(Color.Parse("#BBB")));

            // Shift blocks
            var weekShifts = _vm.ShiftsForWeek(_vm.DisplayWeekStart)
                .Where(s => s.EmployeeId == emp.Id);

            foreach (var shift in weekShifts)
            {
                var dayIndex = (shift.Start.Date - _vm.DisplayWeekStart.Date).TotalDays;
                if (dayIndex < 0 || dayIndex >= 7) continue;

                var blockX = RowHeaderWidth + dayIndex * dayWidth + 2;
                var startFrac = (shift.Start.Hour + shift.Start.Minute / 60.0);
                var endFrac = (shift.End.Hour + shift.End.Minute / 60.0);
                // Clamp to same day if shift spans midnight
                endFrac = Math.Min(endFrac, 24);
                var blockY = rowY + startFrac * HourHeight;
                var blockH = Math.Max(8, (endFrac - startFrac) * HourHeight);
                var blockW = dayWidth - 4;

                var block = CreateShiftBlock(shift, blockX, blockY, blockW, blockH, emp);
                canvas.Children.Add(block);
            }
        }

        // Header border
        DrawLine(canvas, 0, HeaderHeight, RowHeaderWidth + 7 * dayWidth, HeaderHeight, new SolidColorBrush(Color.Parse("#999")));
        DrawLine(canvas, RowHeaderWidth, 0, RowHeaderWidth, HeaderHeight + employees.Count * rowHeight, new SolidColorBrush(Color.Parse("#999")));
    }

    private Border CreateShiftBlock(ShiftAssignment shift, double x, double y, double w, double h, Employee emp)
    {
        var color = GetEmployeeColor(emp);
        var border = new Border
        {
            Background = color,
            BorderBrush = new SolidColorBrush(Colors.White),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(3),
            ClipToBounds = true,
            Tag = shift
        };
        Canvas.SetLeft(border, x);
        Canvas.SetTop(border, y);
        border.Width = w;
        border.Height = h;

        var grid = new Grid();

        var label = new TextBlock
        {
            Text = $"{shift.Label}\n{shift.Start:HH:mm}–{shift.End:HH:mm}",
            FontSize = 10,
            Foreground = Brushes.White,
            Margin = new Thickness(3, 2, 3, 12),
            TextWrapping = Avalonia.Media.TextWrapping.Wrap
        };
        grid.Children.Add(label);

        // Bottom resize handle
        var resizeHandle = new Border
        {
            Height = 8,
            Background = new SolidColorBrush(Color.FromArgb(120, 0, 0, 0)),
            Cursor = new Cursor(StandardCursorType.SizeNorthSouth),
            VerticalAlignment = Avalonia.Layout.VerticalAlignment.Bottom,
            Tag = shift
        };
        resizeHandle.PointerPressed += OnResizeHandlePressed;
        grid.Children.Add(resizeHandle);

        border.Child = grid;

        // Drag-move on the main block
        border.PointerPressed += OnShiftBlockPressed;
        border.PointerMoved += OnPointerMoved;
        border.PointerReleased += OnPointerReleased;
        resizeHandle.PointerMoved += OnPointerMoved;
        resizeHandle.PointerReleased += OnPointerReleased;

        return border;
    }

    // --- Drag/Resize ---

    private void OnShiftBlockPressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not Border block) return;
        var shift = block.Tag as ShiftAssignment;
        if (shift == null) return;

        _draggingBlock = block;
        _draggingShift = shift;
        _isResizing = false;
        _dragOffset = e.GetPosition(block);
        block.ZIndex = 100;
        e.Pointer.Capture(block);
        e.Handled = true;
    }

    private void OnResizeHandlePressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not Border handle) return;
        var shift = handle.Tag as ShiftAssignment;
        if (shift == null) return;

        // Find parent block
        _draggingShift = shift;
        _isResizing = true;
        _draggingBlock = FindBlockForShift(shift);
        if (_draggingBlock != null)
        {
            _blockOriginalHeight = _draggingBlock.Height;
            _blockOriginalTop = Canvas.GetTop(_draggingBlock);
        }
        e.Pointer.Capture(handle);
        e.Handled = true;
    }

    private void OnPointerMoved(object? sender, PointerEventArgs e)
    {
        if (_draggingShift == null || _draggingBlock == null) return;

        var canvas = CalendarCanvas;
        var pos = e.GetPosition(canvas);

        if (_isResizing)
        {
            // Resize: adjust height
            var newH = Math.Max(HourHeight * 0.5, pos.Y - _blockOriginalTop);
            _draggingBlock.Height = newH;
        }
        else
        {
            // Move: update block position
            var newX = pos.X - _dragOffset.X;
            var newY = pos.Y - _dragOffset.Y;
            Canvas.SetLeft(_draggingBlock, newX);
            Canvas.SetTop(_draggingBlock, newY);
        }
        e.Handled = true;
    }

    private void OnPointerReleased(object? sender, PointerReleasedEventArgs e)
    {
        if (_draggingShift == null || _draggingBlock == null)
        {
            _draggingBlock = null;
            _draggingShift = null;
            return;
        }

        var canvas = CalendarCanvas;
        var canvasWidth = canvas.Bounds.Width > 0 ? canvas.Bounds.Width : 1100;
        var dayWidth = Math.Max(MinCellWidth, (canvasWidth - RowHeaderWidth) / 7.0);

        if (_isResizing)
        {
            // Convert new height back to end time
            var blockTop = _blockOriginalTop;
            var empIndex = GetEmployeeIndexFromY(blockTop);
            if (empIndex >= 0)
            {
                var relativeY = _draggingBlock.Height;
                var relativeTop = blockTop - (HeaderHeight + empIndex * HourHeight * 24);
                var endHour = (relativeTop + relativeY) / HourHeight;
                endHour = Math.Clamp(endHour, 0, 24);
                var newEnd = _draggingShift.Start.Date.AddHours(endHour);
                _vm.ResizeShift(_draggingShift, newEnd);
            }
        }
        else
        {
            // Convert position to day/time
            var blockX = Canvas.GetLeft(_draggingBlock);
            var blockY = Canvas.GetTop(_draggingBlock);
            var dayIndex = (int)Math.Round((blockX - RowHeaderWidth) / dayWidth);
            dayIndex = Math.Clamp(dayIndex, 0, 6);
            var empIndex = GetEmployeeIndexFromY(blockY);
            var hourInDay = Math.Clamp((blockY - HeaderHeight - (Math.Max(0, empIndex) * HourHeight * 24)) / HourHeight, 0, 23.5);

            var newDate = _vm.DisplayWeekStart.AddDays(dayIndex);
            var newStart = newDate.Date.AddHours(Math.Floor(hourInDay)).AddMinutes((hourInDay % 1) >= 0.5 ? 30 : 0);

            // Keep employee association (don't change employee on drop)
            _vm.MoveShift(_draggingShift, newStart);
        }

        _draggingBlock.ZIndex = 0;
        _draggingBlock = null;
        _draggingShift = null;
        _isResizing = false;

        DrawCalendar();
        e.Handled = true;
    }

    private int GetEmployeeIndexFromY(double y)
    {
        var relY = y - HeaderHeight;
        if (relY < 0) return 0;
        return (int)(relY / (HourHeight * 24));
    }

    private Border? FindBlockForShift(ShiftAssignment shift)
    {
        foreach (var child in CalendarCanvas.Children)
            if (child is Border b && b.Tag == shift) return b;
        return null;
    }

    // --- Drawing helpers ---

    private static void DrawRect(Canvas canvas, double x, double y, double w, double h, IBrush brush)
    {
        var rect = new Border { Width = w, Height = h, Background = brush };
        Canvas.SetLeft(rect, x);
        Canvas.SetTop(rect, y);
        canvas.Children.Add(rect);
    }

    private static void DrawLine(Canvas canvas, double x1, double y1, double x2, double y2, IBrush brush)
    {
        var line = new Avalonia.Controls.Shapes.Line
        {
            StartPoint = new Point(x1, y1),
            EndPoint = new Point(x2, y2),
            Stroke = brush,
            StrokeThickness = 1
        };
        canvas.Children.Add(line);
    }

    private static void DrawText(Canvas canvas, string text, double x, double y, double fontSize, IBrush foreground, double maxWidth = 200)
    {
        var tb = new TextBlock
        {
            Text = text,
            FontSize = fontSize,
            Foreground = foreground,
            MaxWidth = maxWidth,
            TextWrapping = Avalonia.Media.TextWrapping.Wrap
        };
        Canvas.SetLeft(tb, x);
        Canvas.SetTop(tb, y);
        canvas.Children.Add(tb);
    }

    private static readonly IBrush[] EmployeeColors =
    {
        new SolidColorBrush(Color.Parse("#4A90D9")),
        new SolidColorBrush(Color.Parse("#E67E22")),
        new SolidColorBrush(Color.Parse("#27AE60")),
        new SolidColorBrush(Color.Parse("#8E44AD")),
        new SolidColorBrush(Color.Parse("#C0392B")),
        new SolidColorBrush(Color.Parse("#16A085")),
    };

    private IBrush GetEmployeeColor(Employee emp)
    {
        var idx = _vm.Employees.IndexOf(emp);
        return EmployeeColors[Math.Abs(idx) % EmployeeColors.Length];
    }

    private async System.Threading.Tasks.Task ShowError(string message)
    {
        var box = new Window
        {
            Title = "Error",
            Width = 400,
            Height = 150,
            Content = new TextBlock
            {
                Text = message,
                TextWrapping = Avalonia.Media.TextWrapping.Wrap,
                Margin = new Thickness(16)
            }
        };
        await box.ShowDialog(this);
    }
}
