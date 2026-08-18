using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Platform.Storage;
using CathyPlanning.App.Dialogs;
using CathyPlanning.App.ViewModels;
using CathyPlanning.Domain.Entities;
using CathyPlanning.Infrastructure.Persistence;

namespace CathyPlanning.App;

public partial class MainWindow : Window
{
    private MainViewModel _vm = new();
    private readonly SessionRepository _repo = new();

    // Layout constants
    private const double HeaderHeight   = 36;
    private const double RowHeaderWidth = 100;
    private const double HourHeight     = 40;
    private const double MinCellWidth   = 60;

    // Drag / resize state for existing shift blocks
    private Border?         _draggingBlock;
    private ShiftAssignment? _draggingShift;
    private Point           _dragOffset;
    private bool            _isResizing;
    private double          _blockOriginalHeight;
    private double          _blockOriginalTop;
    private bool            _dragMoved;      // true once pointer moved > 4 px

    // New-shift drag state (drawing on empty canvas area)
    private bool            _creatingShift;
    private Point           _createStartPos;
    private Border?         _rubberBand;

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

        this.FindControl<Button>("BtnGenerate")!.Click     += (_, _) => { _vm.GeneratePlan();  DrawCalendar(); };
        this.FindControl<Button>("BtnPrev")!.Click         += (_, _) => { _vm.PreviousWeek();  DrawCalendar(); };
        this.FindControl<Button>("BtnNext")!.Click         += (_, _) => { _vm.NextWeek();       DrawCalendar(); };
        this.FindControl<Button>("BtnToday")!.Click        += (_, _) => { _vm.GoToToday();      DrawCalendar(); };

        this.FindControl<Button>("BtnManagePeople")!.Click += async (_, _) =>
        {
            var dlg = new EmployeeManagerDialog(_vm) { };
            await dlg.ShowDialog(this);
            DrawCalendar();
        };

        // Period radio buttons
        this.FindControl<RadioButton>("RbDay")!.IsCheckedChanged += (s, _) =>
        {
            if (s is RadioButton { IsChecked: true })
            { _vm.SelectedPeriod = ReportPeriod.Day; RefreshReport(); }
        };
        this.FindControl<RadioButton>("RbWeek")!.IsCheckedChanged += (s, _) =>
        {
            if (s is RadioButton { IsChecked: true })
            { _vm.SelectedPeriod = ReportPeriod.Week; RefreshReport(); }
        };
        this.FindControl<RadioButton>("RbMonth")!.IsCheckedChanged += (s, _) =>
        {
            if (s is RadioButton { IsChecked: true })
            { _vm.SelectedPeriod = ReportPeriod.Month; RefreshReport(); }
        };

        // Canvas-level pointer events for new-shift creation
        CalendarCanvas.PointerPressed  += OnCanvasPointerPressed;
        CalendarCanvas.PointerMoved    += OnCanvasPointerMoved;
        CalendarCanvas.PointerReleased += OnCanvasPointerReleased;

        SizeChanged += (_, _) => DrawCalendar();
    }

    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------

    private void DrawCalendar()
    {
        var canvas = CalendarCanvas;
        canvas.Children.Clear();

        TxtWeekLabel.Text = _vm.WeekLabel;
        RefreshReport();

        var canvasWidth = canvas.Bounds.Width > 0 ? canvas.Bounds.Width : 1100;
        var gridWidth   = canvasWidth - RowHeaderWidth;
        var dayWidth    = Math.Max(MinCellWidth, gridWidth / 7.0);

        var employees = _vm.Employees;
        var rowHeight = HourHeight * 24;

        canvas.Background = Brushes.White;

        // Day headers
        for (int d = 0; d < 7; d++)
        {
            var day = _vm.DisplayWeekStart.AddDays(d);
            var x   = RowHeaderWidth + d * dayWidth;
            DrawRect(canvas, x, 0, dayWidth - 1, HeaderHeight,
                day.Date == DateTime.Today.Date
                    ? new SolidColorBrush(Color.Parse("#D0E8FF"))
                    : new SolidColorBrush(Color.Parse("#E8EDF2")));
            DrawText(canvas, day.ToString("ddd\ndd"), x + 4, 4, 11, Brushes.Black, dayWidth - 8);
            DrawLine(canvas, x, 0, x, HeaderHeight + employees.Count * rowHeight, new SolidColorBrush(Color.Parse("#CCC")));
        }
        DrawLine(canvas, RowHeaderWidth + 7 * dayWidth, 0, RowHeaderWidth + 7 * dayWidth, HeaderHeight + employees.Count * rowHeight, new SolidColorBrush(Color.Parse("#CCC")));

        // Employee rows
        for (int e = 0; e < employees.Count; e++)
        {
            var emp  = employees[e];
            var rowY = HeaderHeight + e * rowHeight;

            DrawRect(canvas, 0, rowY, RowHeaderWidth - 1, rowHeight, new SolidColorBrush(Color.Parse("#F4F7FA")));
            DrawText(canvas, emp.Name, 4, rowY + 4, 11, Brushes.Black, RowHeaderWidth - 8);

            for (int h = 0; h <= 24; h++)
            {
                var lineY = rowY + h * HourHeight;
                DrawLine(canvas, RowHeaderWidth, lineY, RowHeaderWidth + 7 * dayWidth, lineY,
                    h % 4 == 0 ? new SolidColorBrush(Color.Parse("#DDD")) : new SolidColorBrush(Color.Parse("#F0F0F0")));
                if (h < 24 && h % 4 == 0)
                    DrawText(canvas, $"{h:00}:00", 2, lineY + 1, 9, new SolidColorBrush(Color.Parse("#888")), RowHeaderWidth - 4);
            }

            DrawLine(canvas, 0, rowY + rowHeight, RowHeaderWidth + 7 * dayWidth, rowY + rowHeight, new SolidColorBrush(Color.Parse("#BBB")));

            foreach (var shift in _vm.ShiftsForWeek(_vm.DisplayWeekStart).Where(s => s.EmployeeId == emp.Id))
            {
                var dayIndex = (shift.Start.Date - _vm.DisplayWeekStart.Date).TotalDays;
                if (dayIndex < 0 || dayIndex >= 7) continue;

                var blockX   = RowHeaderWidth + dayIndex * dayWidth + 2;
                var startFrac = shift.Start.Hour + shift.Start.Minute / 60.0;
                var endFrac   = Math.Min(shift.End.Hour + shift.End.Minute / 60.0, 24);
                var blockY   = rowY + startFrac * HourHeight;
                var blockH   = Math.Max(8, (endFrac - startFrac) * HourHeight);
                var blockW   = dayWidth - 4;

                canvas.Children.Add(CreateShiftBlock(shift, blockX, blockY, blockW, blockH, emp));
            }
        }

        DrawLine(canvas, 0, HeaderHeight, RowHeaderWidth + 7 * dayWidth, HeaderHeight, new SolidColorBrush(Color.Parse("#999")));
        DrawLine(canvas, RowHeaderWidth, 0, RowHeaderWidth, HeaderHeight + employees.Count * rowHeight, new SolidColorBrush(Color.Parse("#999")));
    }

    private void RefreshReport()
    {
        _vm.RefreshSummaries();

        var panel  = this.FindControl<StackPanel>("ReportTablePanel")!;
        panel.Children.Clear();

        var report = _vm.LastReport;
        if (report == null) return;

        // Header row
        panel.Children.Add(BuildReportRow(true, "Employee", "Hours", "Max", "%", "Viol."));

        foreach (var s in report.HoursSummaries)
        {
            var over   = s.PercentUsed > 100;
            panel.Children.Add(BuildReportRow(false,
                s.EmployeeName,
                $"{s.TotalHours:F1}h",
                $"{s.MaxWeeklyHours:F0}h",
                $"{s.PercentUsed:F0}%",
                s.ViolationCount > 0 ? $"⚠ {s.ViolationCount}" : "✅",
                over));
        }

        this.FindControl<TextBlock>("TxtCompliance")!.Text = _vm.ComplianceSummary;
    }

    private static StackPanel BuildReportRow(bool header, string emp, string hours, string max, string pct, string viol, bool highlight = false)
    {
        IBrush fg = header   ? Brushes.White :
                    highlight ? new SolidColorBrush(Color.Parse("#C0392B")) : Brushes.Black;
        IBrush bg = header   ? new SolidColorBrush(Color.Parse("#4A90D9")) :
                    highlight ? new SolidColorBrush(Color.Parse("#FDECEA")) :
                                new SolidColorBrush(Color.Parse("#F7F9FC"));

        var row = new Border
        {
            Background      = bg,
            CornerRadius    = new CornerRadius(2),
            Margin          = new Thickness(0, 1),
            Padding         = new Thickness(4, 2)
        };
        var sp = new StackPanel { Orientation = Orientation.Horizontal };

        void Cell(string text, double w, bool bold = false)
        {
            sp.Children.Add(new TextBlock
            {
                Text       = text,
                Width      = w,
                Foreground = fg,
                FontWeight = bold || header ? FontWeight.SemiBold : FontWeight.Normal,
                FontSize   = 11,
                TextTrimming = Avalonia.Media.TextTrimming.CharacterEllipsis
            });
        }

        Cell(emp,  110, header);
        Cell(hours, 44);
        Cell(max,   38);
        Cell(pct,   36);
        Cell(viol,  36);

        row.Child = sp;
        return new StackPanel { Children = { row } };
    }

    // -------------------------------------------------------------------------
    // Shift block creation
    // -------------------------------------------------------------------------

    private Border CreateShiftBlock(ShiftAssignment shift, double x, double y, double w, double h, Employee emp)
    {
        var color = GetEmployeeColor(emp);
        var border = new Border
        {
            Background      = color,
            BorderBrush     = new SolidColorBrush(Colors.White),
            BorderThickness = new Thickness(1),
            CornerRadius    = new CornerRadius(3),
            ClipToBounds    = true,
            Tag             = shift
        };
        Canvas.SetLeft(border, x);
        Canvas.SetTop(border, y);
        border.Width  = w;
        border.Height = h;

        var grid  = new Grid();
        var label = new TextBlock
        {
            Text         = $"{shift.Label}\n{shift.Start:HH:mm}–{shift.End:HH:mm}",
            FontSize     = 10,
            Foreground   = Brushes.White,
            Margin       = new Thickness(3, 2, 3, 12),
            TextWrapping = Avalonia.Media.TextWrapping.Wrap
        };
        grid.Children.Add(label);

        var resizeHandle = new Border
        {
            Height            = 8,
            Background        = new SolidColorBrush(Color.FromArgb(120, 0, 0, 0)),
            Cursor            = new Cursor(StandardCursorType.SizeNorthSouth),
            VerticalAlignment = VerticalAlignment.Bottom,
            Tag               = shift
        };
        resizeHandle.PointerPressed  += OnResizeHandlePressed;
        resizeHandle.PointerMoved    += OnPointerMoved;
        resizeHandle.PointerReleased += OnPointerReleased;
        grid.Children.Add(resizeHandle);

        border.Child = grid;
        border.PointerPressed  += OnShiftBlockPressed;
        border.PointerMoved    += OnPointerMoved;
        border.PointerReleased += OnPointerReleased;

        return border;
    }

    // -------------------------------------------------------------------------
    // Drag / resize existing shifts
    // -------------------------------------------------------------------------

    private void OnShiftBlockPressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not Border block) return;
        if (block.Tag is not ShiftAssignment shift) return;

        _draggingBlock = block;
        _draggingShift = shift;
        _isResizing    = false;
        _dragMoved     = false;
        _dragOffset    = e.GetPosition(block);
        block.ZIndex   = 100;
        e.Pointer.Capture(block);
        e.Handled = true;
        // Suppress canvas creation handler
        _creatingShift = false;
    }

    private void OnResizeHandlePressed(object? sender, PointerPressedEventArgs e)
    {
        if (sender is not Border handle) return;
        if (handle.Tag is not ShiftAssignment shift) return;

        _draggingShift       = shift;
        _isResizing          = true;
        _dragMoved           = false;
        _draggingBlock       = FindBlockForShift(shift);
        if (_draggingBlock != null)
        {
            _blockOriginalHeight = _draggingBlock.Height;
            _blockOriginalTop    = Canvas.GetTop(_draggingBlock);
        }
        e.Pointer.Capture(handle);
        e.Handled = true;
        _creatingShift = false;
    }

    private void OnPointerMoved(object? sender, PointerEventArgs e)
    {
        if (_draggingShift == null || _draggingBlock == null) return;

        var pos = e.GetPosition(CalendarCanvas);

        if (_isResizing)
        {
            var newH = Math.Max(HourHeight * 0.5, pos.Y - _blockOriginalTop);
            _draggingBlock.Height = newH;
        }
        else
        {
            var newX = pos.X - _dragOffset.X;
            var newY = pos.Y - _dragOffset.Y;
            // Check if we actually moved (to distinguish click-to-edit)
            var origX = Canvas.GetLeft(_draggingBlock);
            var origY = Canvas.GetTop(_draggingBlock);
            if (Math.Abs(newX - origX) > 4 || Math.Abs(newY - origY) > 4)
                _dragMoved = true;
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

        var canvas     = CalendarCanvas;
        var canvasWidth = canvas.Bounds.Width > 0 ? canvas.Bounds.Width : 1100;
        var dayWidth   = Math.Max(MinCellWidth, (canvasWidth - RowHeaderWidth) / 7.0);

        if (!_dragMoved && !_isResizing)
        {
            // Treat as a click → open edit dialog
            var shiftToEdit = _draggingShift;
            _draggingBlock.ZIndex = 0;
            _draggingBlock = null;
            _draggingShift = null;
            _isResizing    = false;
            e.Handled      = true;
            OpenEditDialog(shiftToEdit);
            return;
        }

        if (_isResizing)
        {
            var blockTop  = _blockOriginalTop;
            var empIndex  = GetEmployeeIndexFromY(blockTop);
            if (empIndex >= 0)
            {
                var relativeTop = blockTop - (HeaderHeight + empIndex * HourHeight * 24);
                var endHour     = Math.Clamp((relativeTop + _draggingBlock.Height) / HourHeight, 0, 24);
                var newEnd      = _draggingShift.Start.Date.AddHours(endHour);
                _vm.ResizeShift(_draggingShift, newEnd);
            }
        }
        else
        {
            var blockX   = Canvas.GetLeft(_draggingBlock);
            var blockY   = Canvas.GetTop(_draggingBlock);
            var dayIndex = Math.Clamp((int)Math.Round((blockX - RowHeaderWidth) / dayWidth), 0, 6);
            var empIndex = GetEmployeeIndexFromY(blockY);
            var hourInDay = Math.Clamp((blockY - HeaderHeight - Math.Max(0, empIndex) * HourHeight * 24) / HourHeight, 0, 23.5);

            var newDate  = _vm.DisplayWeekStart.AddDays(dayIndex);
            var newStart = newDate.Date
                .AddHours(Math.Floor(hourInDay))
                .AddMinutes((hourInDay % 1) >= 0.5 ? 30 : 0);
            _vm.MoveShift(_draggingShift, newStart);
        }

        _draggingBlock.ZIndex = 0;
        _draggingBlock = null;
        _draggingShift = null;
        _isResizing    = false;
        _dragMoved     = false;

        DrawCalendar();
        e.Handled = true;
    }

    // -------------------------------------------------------------------------
    // New-shift creation by drag on empty canvas area
    // -------------------------------------------------------------------------

    private void OnCanvasPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        // Only start a new shift if we're not already interacting with a block
        if (_draggingShift != null) return;

        var pos = e.GetPosition(CalendarCanvas);
        // Must be in the grid area (right of row header, below day header)
        if (pos.X < RowHeaderWidth || pos.Y < HeaderHeight) return;

        _creatingShift = true;
        _createStartPos = pos;

        // Create rubber-band
        _rubberBand = new Border
        {
            Background      = new SolidColorBrush(Color.FromArgb(80, 74, 144, 217)),
            BorderBrush     = new SolidColorBrush(Color.Parse("#4A90D9")),
            BorderThickness = new Thickness(1),
            CornerRadius    = new CornerRadius(2),
            ZIndex          = 200
        };
        Canvas.SetLeft(_rubberBand, pos.X);
        Canvas.SetTop(_rubberBand, pos.Y);
        _rubberBand.Width  = 0;
        _rubberBand.Height = 0;
        CalendarCanvas.Children.Add(_rubberBand);

        e.Pointer.Capture(CalendarCanvas);
        e.Handled = true;
    }

    private void OnCanvasPointerMoved(object? sender, PointerEventArgs e)
    {
        if (!_creatingShift || _rubberBand == null) return;

        var pos = e.GetPosition(CalendarCanvas);
        var x   = Math.Min(pos.X, _createStartPos.X);
        var y   = Math.Min(pos.Y, _createStartPos.Y);
        var w   = Math.Abs(pos.X - _createStartPos.X);
        var h   = Math.Abs(pos.Y - _createStartPos.Y);

        Canvas.SetLeft(_rubberBand, x);
        Canvas.SetTop(_rubberBand, y);
        _rubberBand.Width  = w;
        _rubberBand.Height = h;
        e.Handled = true;
    }

    private void OnCanvasPointerReleased(object? sender, PointerReleasedEventArgs e)
    {
        if (!_creatingShift || _rubberBand == null)
        {
            _creatingShift = false;
            return;
        }

        _creatingShift = false;
        CalendarCanvas.Children.Remove(_rubberBand);
        _rubberBand = null;

        var pos       = e.GetPosition(CalendarCanvas);
        var canvasWidth = CalendarCanvas.Bounds.Width > 0 ? CalendarCanvas.Bounds.Width : 1100;
        var dayWidth  = Math.Max(MinCellWidth, (canvasWidth - RowHeaderWidth) / 7.0);

        // Determine the column (day)
        var dayIndex  = Math.Clamp((int)((_createStartPos.X - RowHeaderWidth) / dayWidth), 0, 6);

        // Convert Y positions to times
        var empIndex  = GetEmployeeIndexFromY(_createStartPos.Y);
        var rowBaseY  = HeaderHeight + Math.Max(0, empIndex) * HourHeight * 24;
        double HourFromY(double y) => Math.Clamp((y - rowBaseY) / HourHeight, 0, 24);

        var startHour = HourFromY(Math.Min(_createStartPos.Y, pos.Y));
        var endHour   = HourFromY(Math.Max(_createStartPos.Y, pos.Y));

        // Snap to 15-min increments
        DateTime SnapTime(DateTime date, double hour)
        {
            var totalMin = (int)(hour * 60);
            totalMin = (int)Math.Round(totalMin / 15.0) * 15;
            return date.Date.AddMinutes(totalMin);
        }

        var baseDate = _vm.DisplayWeekStart.AddDays(dayIndex);
        var start    = SnapTime(baseDate, startHour);
        var end      = SnapTime(baseDate, endHour);

        // Minimum 15 minutes
        if ((end - start).TotalMinutes < 15)
        {
            e.Handled = true;
            return;
        }

        e.Handled = true;
        OpenAssignDialog(start, end);
    }

    private async void OpenAssignDialog(DateTime start, DateTime end)
    {
        if (_vm.Employees.Count == 0)
        {
            await ShowError("No employees defined. Add employees first via 'Manage People'.");
            return;
        }
        var dlg = new AssignShiftDialog(_vm.Employees, start, end);
        await dlg.ShowDialog(this);
        if (dlg.Confirmed && dlg.SelectedEmployeeId.HasValue)
        {
            _vm.AddShift(dlg.SelectedEmployeeId.Value, dlg.ResultStart, dlg.ResultEnd, dlg.ResultLabel);
            DrawCalendar();
        }
    }

    private async void OpenEditDialog(ShiftAssignment shift)
    {
        var dlg = new EditShiftDialog(_vm.Employees, shift);
        await dlg.ShowDialog(this);
        switch (dlg.Result)
        {
            case EditShiftResult.Saved:
                _vm.UpdateShift(shift.Id, dlg.ResultEmployeeId, dlg.ResultStart, dlg.ResultEnd, dlg.ResultLabel);
                break;
            case EditShiftResult.Deleted:
                _vm.DeleteShift(shift.Id);
                break;
        }
        DrawCalendar();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

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
            StartPoint      = new Point(x1, y1),
            EndPoint        = new Point(x2, y2),
            Stroke          = brush,
            StrokeThickness = 1
        };
        canvas.Children.Add(line);
    }

    private static void DrawText(Canvas canvas, string text, double x, double y, double fontSize, IBrush foreground, double maxWidth = 200)
    {
        var tb = new TextBlock
        {
            Text         = text,
            FontSize     = fontSize,
            Foreground   = foreground,
            MaxWidth     = maxWidth,
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
            Title   = "Error",
            Width   = 400,
            Height  = 150,
            Content = new TextBlock
            {
                Text         = message,
                TextWrapping = Avalonia.Media.TextWrapping.Wrap,
                Margin       = new Thickness(16)
            }
        };
        await box.ShowDialog(this);
    }
}
