import { EffectScatterChart, MapChart } from 'echarts/charts';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([MapChart, EffectScatterChart, GeoComponent, TooltipComponent, CanvasRenderer]);

export { echarts };
