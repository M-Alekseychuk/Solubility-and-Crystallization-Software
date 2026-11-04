import xlsxwriter

workbook = xlsxwriter.Workbook('public/chart_template.xlsx')

worksheet = workbook.add_worksheet('Calibration')

headers = ['ID', 'Mass (mg)', 'Solvent Vol (mL)', 'Concentration (mg/mL)', 'UV Area']
for col, h in enumerate(headers):
    worksheet.write(0, col, h)

chart = workbook.add_chart({'type': 'scatter', 'subtype': 'straight_with_markers'})

chart.add_series({
    'name': 'Calibration Curve',
    'categories': ['Calibration', 1, 3, 5, 3], 
    'values':     ['Calibration', 1, 4, 5, 4], 
    'marker': {'type': 'circle', 'size': 6, 'border': {'color': '#ffffff'}, 'fill': {'color': '#3b82f6'}},
    'line':   {'color': '#10b981', 'width': 2},
    'trendline': {
        'type': 'linear',
        'display_equation': True,
        'display_r_squared': True,
        'line': {
            'color': '#10b981',
            'width': 2,
        }
    }
})

chart.set_title({'none': True})
chart.set_x_axis({'name': 'Concentration in mg/mL'})
chart.set_y_axis({'name': 'Absorbtion in mAU'})
chart.set_legend({'position': 'none'})

worksheet.insert_chart('G2', chart, {'x_scale': 1.45, 'y_scale': 1.15})

worksheet.write_string(7, 0, "Regression Results")
worksheet.write_string(8, 0, "Equation:")
worksheet.write_string(9, 0, "Slope (m):")
worksheet.write_string(10, 0, "Intercept (c):")
worksheet.write_string(11, 0, "R Squared (R²):")
worksheet.write_string(12, 0, "Wavelength (nm):")
worksheet.write_string(13, 0, "HPLC Used:")

ws2 = workbook.add_worksheet('Samples')
s_headers = ['Sample Name', 'Solvent 1', 'Solvent 2', 'Solv 1 (%)', 'Temp (°C)', 'UV Area', 'Sampling Vol. (µL)', 'Added Solvent (mL)', 'Reaction Conc. (mg/mL)']
for col, h in enumerate(s_headers):
    ws2.write(0, col, h)

workbook.close()
