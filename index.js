class ChartManager {
  constructor() {
    this.chart = null;
    this.xspan = null;
    this.klines = null;
    this.startPoint = null;
    this.lineSeries = null;
    this.isUpdatingLine = false;
    this.isHovered = false;
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragStartLineData = null;
    this.lastCrosshairPosition = null;
    this.candleseries = null;
    this.selectedPoint = null; //null/0/1
    this.hoverThreshold = 0.01;
    this.domElement = document.getElementById("tvchart");
    this.initializeChart();
    this.subscribeToEvents();
    this.loadData();
  }

  initializeChart() {
    const chartProperties = {
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
    };
    this.chart = LightweightCharts.createChart(
      this.domElement,
      chartProperties
    );
    this.candleseries = this.chart.addCandlestickSeries();
    this.lineSeries = this.chart.addLineSeries();
  }

  subscribeToEvents() {
    this.chart.subscribeClick(this.handleChartClick.bind(this));
    this.chart.subscribeCrosshairMove(this.handleCrosshairMove.bind(this));
    this.domElement.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this)
    );
    this.domElement.addEventListener("mouseup", this.handleMouseUp.bind(this));
  }

  async loadData() {
    try {
      const response = await fetch("./data.json");
      const data = await response.json();
      this.klines = data.data.map((item) => ({
        time: Math.floor(new Date(item.date).getTime() / 1000),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));
      this.xspan = data.data
        .map((item) => Math.floor(new Date(item.date).getTime() / 1000))
        .map((d, i, arr) => (i ? arr[i] - arr[i - 1] : 0))[2];
      const prebars = [...new Array(100)].map((_, i) => ({
        time: this.klines[0].time - (i + 1) * this.xspan,
      }));
      const postbars = [...new Array(100)].map((_, i) => ({
        time: this.klines[this.klines.length - 1].time + (i + 1) * this.xspan,
      }));
      this.candleseries.setData([...prebars, ...this.klines, ...postbars]);
    } catch (error) {
      console.error("Error fetching or parsing data:", error);
    }
  }

  handleChartClick(param) {
    console.log("handleChartClick triggered");
    if (this.isUpdatingLine) return;
    if (this.isDragging) return;
    const xTs = param.time
      ? param.time
      : this.klines[0]["time"] + param.logical * this.xspan;
    const yPrice = this.candleseries.coordinateToPrice(param.point.y);
    this.isHovered
      ? this.startDrag(xTs, yPrice)
      : this.handleLineDrawing(xTs, yPrice);
  }

  handleCrosshairMove(param) {
    if (this.isUpdatingLine) return;
    const xTs = param.time
      ? param.time
      : this.klines[0]["time"] + param.logical * this.xspan;
    const yPrice = this.candleseries.coordinateToPrice(param.point.y);
    this.lastCrosshairPosition = { x: xTs, y: yPrice };

    this.startPoint
      ? this.updateLine(xTs, yPrice)
      : this.handleHoverEffect(xTs, yPrice);

    if (this.isDragging) {
      const deltaX = xTs - this.dragStartPoint.x;
      const deltaY = yPrice - this.dragStartPoint.y;

      let newLineData;
      newLineData = this.dragStartLineData.map((point, i) =>
        this.selectedPoint !== null
          ? i === this.selectedPoint
            ? {
                time: point.time + deltaX,
                value: point.value + deltaY,
              }
            : point
          : {
              time: point.time + deltaX,
              value: point.value + deltaY,
            }
      );

      this.dragLine(newLineData);
    }
  }

  handleMouseDown(e) {
    if (!this.lastCrosshairPosition) return;
    if (this.isHovered) {
      this.startDrag(
        this.lastCrosshairPosition.x,
        this.lastCrosshairPosition.y
      );
    }
  }

  handleMouseUp() {
    this.endDrag();
  }

  handleLineDrawing(xTs, yPrice) {
    if (!this.startPoint) {
      this.startPoint = { time: xTs, price: yPrice };
    } else {
      this.lineSeries.setData([
        { time: this.startPoint.time, value: this.startPoint.price },
        { time: xTs, value: yPrice },
      ]);
      this.startPoint = null;
      this.selectedPoint = null;
    }
  }

  handleHoverEffect(xTs, yPrice) {
    const linedata = this.lineSeries.data();
    if (!linedata.length) return;

    const hoverStatus = this.isLineHovered(
      xTs,
      yPrice,
      linedata[0],
      linedata[1]
    );
    if (hoverStatus && !this.isHovered) {
      this.startHover();
    }

    if (!hoverStatus && this.isHovered && !this.isDragging) {
      this.endHover();
    }
  }

  startHover() {
    this.isHovered = true;
    this.lineSeries.applyOptions({ color: "orange" });
    this.domElement.style.cursor = "pointer";
    this.chart.applyOptions({ handleScroll: false, handleScale: false });
  }

  endHover() {
    this.isHovered = false;
    this.lineSeries.applyOptions({ color: "dodgerblue" });
    this.domElement.style.cursor = "default";
    this.chart.applyOptions({ handleScroll: true, handleScale: true });
  }

  startDrag(xTs, yPrice) {
    console.log("startDrag triggered");
    this.isDragging = true;
    this.dragStartPoint = { x: xTs, y: yPrice };
    this.dragStartLineData = [...this.lineSeries.data()];
  }

  endDrag() {
    console.log("endDrag triggered");
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragStartLineData = null;
    this.selectedPoint = null;
  }

  updateLine(xTs, yPrice) {
    this.isUpdatingLine = true;
    this.lineSeries.setData([
      { time: this.startPoint.time, value: this.startPoint.price },
      { time: xTs, value: yPrice },
    ]);
    this.selectedPoint = null;
    this.isUpdatingLine = false;
  }
  dragLine(newCords) {
    this.isUpdatingLine = true;
    this.lineSeries.setData(newCords);
    this.isUpdatingLine = false;
  }

  isLineHovered(xTs, yPrice, point1, point2) {
    // CHECK IF POINT IS SELECTED
    if (this.isDragging) return true;
    const isPoint1 =
      xTs === point1.time &&
      (Math.abs(yPrice - point1.value) * 100) / yPrice < this.hoverThreshold;
    if (isPoint1) {
      this.selectedPoint = 0;
      return true;
    }
    const isPoint2 =
      xTs === point2.time &&
      (Math.abs(yPrice - point2.value) * 100) / yPrice < this.hoverThreshold;
    if (isPoint2) {
      this.selectedPoint = 1;
      return true;
    }

    this.selectedPoint = null;
    const m = (point2.value - point1.value) / (point2.time - point1.time);
    const c = point1.value - m * point1.time;
    const estimatedY = m * xTs + c;
    return (Math.abs(yPrice - estimatedY) * 100) / yPrice < this.hoverThreshold;
  }
}

const manager = new ChartManager();
