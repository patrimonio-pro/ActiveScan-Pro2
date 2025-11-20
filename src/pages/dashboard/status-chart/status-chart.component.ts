import { Component, ChangeDetectionStrategy, input, ElementRef, AfterViewInit, viewChild, effect, computed } from '@angular/core';
import * as d3 from 'd3';

export interface ChartData {
  label: string;
  value: number;
}

@Component({
  selector: 'app-status-chart',
  standalone: true,
  template: `
    <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h4 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Bens por Situação</h4>
      <div #chartContainer class="w-full h-auto max-w-sm mx-auto"></div>
      
      @if (hasDataToDisplay()) {
        <div class="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
          @for (item of filteredData(); track item.label) {
            <div class="flex items-center text-sm">
              <span class="w-3 h-3 rounded-full mr-2" [style.background-color]="getColor(item.label)"></span>
              <span class="text-gray-600 dark:text-gray-400">{{ item.label }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChartComponent implements AfterViewInit {
  data = input.required<ChartData[]>();
  chartContainer = viewChild.required<ElementRef>('chartContainer');

  filteredData = computed(() => this.data().filter(d => d.value > 0));
  hasDataToDisplay = computed(() => this.filteredData().length > 0);

  private colorScale = d3.scaleOrdinal<string>()
    .domain(['Ativos', 'Manutenção', 'Baixados / Inativos'])
    .range(['#10B981', '#F59E0B', '#6B7280']); // Green, Yellow, Gray

  constructor() {
    effect(() => {
      // Redraw chart if data changes
      if (this.chartContainer()) {
        this.createChart();
      }
    });
  }

  ngAfterViewInit() {
    // A small delay to ensure the container has its final dimensions.
    setTimeout(() => this.createChart(), 0);
  }

  getColor(label: string): string {
    return this.colorScale(label);
  }

  private createChart(): void {
    const data = this.filteredData();
    const element = this.chartContainer().nativeElement;
    
    d3.select(element).select('svg').remove(); // Clear previous chart

    if (!this.hasDataToDisplay()) {
      element.innerHTML = `<div class="flex items-center justify-center h-64"><p class="text-gray-500 dark:text-gray-400">Sem dados para exibir.</p></div>`;
      return;
    }
    
    // Use a fixed size for the viewBox coordinate system
    const width = 400;
    const height = 400;
    const margin = 20;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = d3.select(element)
      .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`) // Make it responsive
        .attr('preserveAspectRatio', 'xMidYMid meet')
      .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const pieGenerator = d3.pie<ChartData>()
      .value(d => d.value)
      .sort(null);

    const arcGenerator = d3.arc<any, d3.PieArcDatum<ChartData>>()
      .innerRadius(radius * 0.5) // Donut chart
      .outerRadius(radius);
      
    const arcs = svg.selectAll('.arc')
      .data(pieGenerator(data))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
        .attr('d', arcGenerator)
        .attr('fill', d => this.colorScale(d.data.label))
        .attr('stroke', document.documentElement.classList.contains('dark') ? '#1f2937' : 'white')
        .style('stroke-width', '4px');

    // Add labels
    arcs.append('text')
        .attr('transform', d => `translate(${arcGenerator.centroid(d)})`)
        .attr('dy', '0.35em')
        .style('text-anchor', 'middle')
        .style('font-size', '24px') // Larger font size for better visibility in the scaled chart
        .style('fill', '#fff')
        .style('font-weight', 'bold')
        .text(d => d.data.value);
  }
}
