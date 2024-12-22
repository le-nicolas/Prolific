// chart.js

const renderBarChart = (chartElementId, labels, data, title) => {
    const ctx = document.getElementById(chartElementId).getContext('2d');
  
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: title,
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time Spent (mins)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Activities'
            }
          }
        },
      },
    });
  };
  
  const renderHeatmap = (chartElementId, labelsX, labelsY, data, title) => {
    const ctx = document.getElementById(chartElementId).getContext('2d');
  
    new Chart(ctx, {
      type: 'matrix',
      data: {
        labels: labelsY,
        datasets: [
          {
            label: title,
            data: data,
            backgroundColor: context => {
              const value = context.raw.v;
              const alpha = value / 100; // Normalize value to max intensity
              return `rgba(75, 192, 192, ${alpha})`;
            },
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: context => {
                const { x, y, v } = context.raw;
                return `Time: ${x}, Activity: ${y}, Keystrokes: ${v}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            labels: labelsX,
            title: {
              display: true,
              text: 'Hours of the Day'
            }
          },
          y: {
            type: 'category',
            labels: labelsY,
            title: {
              display: true,
              text: 'Activities'
            }
          },
        },
      },
    });
  };
  