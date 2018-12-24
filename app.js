MouseEvent.prototype.pageCoords = function() {
  return {
    x: this.pageX,
    y: this.pageY
  }; 
}

if (window.TouchEvent) {
  TouchEvent.prototype._pageX = function() {
    //return this.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    if (this.targetTouches.length == 0) return window._lastTouchX;
    window._lastTouchX = this.targetTouches[0].pageX;
    return this.targetTouches[0].pageX;
  }
  TouchEvent.prototype._pageY = function() {          
    //return this.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    if (this.targetTouches.length == 0) return window._lastTouchY;
    window._lastTouchY = this.targetTouches[0].pageY;
    return this.targetTouches[0].pageY;
  }
  TouchEvent.prototype.pageCoords = function() {
    return {
      x: this._pageX(),
      y: this._pageY()
    }; 
  }
}
    
var app = {

  keyBindings: {
    
    // selection
    'CTRL+a': e => app.selectAll(),
    'Escape': e => { app.unselectAll(); app.tool = 'select'; },
    'Delete': e => { while (app.selection.length) app.remove(app.selection[0]) },
    
    // tools
    'CTRL+r': e => { app.tool = 'rect' },
    'CTRL+e': e => { app.tool = 'arc' },
    'CTRL+t': e => { app.tool = 'text' },
    
    'CTRL+s': e => app.download(),
    'CTRL+d': e => {
      var copies = [];
      app.selection.forEach(function(el) {
        copies.push(el.cloneNode());
      });
      app.unselectAll();
      copies.forEach(function(el) {
        app.$canvas.appendChild(el);
        app.select(el);
      });
    },
    
    'CTRL+SHIFT+P': e => app.setCurrentMenu('properties'),
    'CTRL+SHIFT+A': e => app.setCurrentMenu('alignDist'),
    'CTRL+SHIFT+M': e => app.setCurrentMenu('move'),
  },
  
  handlers: {},

  style: {
    fill: 'rgba(0,60,255,0.5)',
    stroke: 'rgba(0,60,255, 0.65)',
    "stroke-width": '2px',
  },
  
  /*status: {},
  updateStatus: function() {
    this.$status.textContent = JSON.stringify(this.status).replace(/[{}"]|/g, '');
  },*/
  
  clear: function() {
    this.topLevelElements().forEach(x => app.$canvas.removeChild(x));
  },
  
  serializeToURL: function() {
    this.unselectAll();
    
    var box =  app.$canvas.getBBox();
    if (box.width * box.height == 0) {
      throw new Error("Failed to export SVG image: area is zero. ("+box.width+"px by "+box.height+"px)");
    }
    
    this.$canvas.setAttribute('width', box.x + box.width);
    this.$canvas.setAttribute('height', box.y + box.height);
    
    var source = this.$canvas.outerHTML;
    
    //add name spaces.
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    
    //add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    
    var svgBlob = new Blob([source], {type:"image/svg+xml;charset=utf-8"});
    console.log(svgBlob)
    return URL.createObjectURL(svgBlob);
  },
  
  download: function() {
    var a = document.createElement('a');
    a.style.display = "none";
    a.href = this.serializeToURL();
    a.download = "Untitled.svg"
    this.$aside.appendChild(a);
    a.click();
    this.$aside.removeChild(a);
  },
  
  topLevelElements: function() {
    return this.$canvas.querySelectorAll('svg > .object');
  },
  
  selection: [],
  select: function(el) {
    if (this.selection.includes(el)) {
      el.outline.update();
      return;
    };
    
    el.outline = app.helpers.createSelectionOutline(el);
    el.classList.add('focused');
    
    app.selection.push(el);
    app.updatePropertiesForm(el);    
    //app.$aside.style.display = "initial";
  },
  selectAll: function() {
    this.topLevelElements().forEach(el => this.select(el));
  },
  unselect: function(el) {
    if (!this.selection.includes(el)) return;
    el.classList.remove('focused');
    el.parentNode.removeChild(el.outline);
    el.outline = null;
    this.selection.splice(this.selection.indexOf(el), 1);
    
    //if (this.selection.length == 0) this.$aside.style.display = "none";
  },
  unselectAll: function() {
    while (this.selection.length) this.unselect(this.selection[0]);
  },
  
  remove: function(el) {
    if (this.selection.includes(el)) this.unselect(el);
    el.parentNode.removeChild(el);
  },
  
  _tool: '',
  get tool() { 
    return this.tools[this._tool]; 
  },
  set tool(toolName) {
    if (!this.tools.hasOwnProperty(toolName)) return;
    
    if (this._tool && this.tool.leave) this.tool.leave();
  
    /*this.status.tool = */this.$toolbar.tool.value = this._tool = toolName; 
    //this.updateStatus();
    this.toolState = 0;
    
    if (this.tool.enter) this.tool.enter();
  },

  toolState: 0,
  
  tools: {
    select: {
      dragRef: null,
      onclick: function(e) {
        if (app.helpers.isEventSelecting(e)) {
          if (e.shiftKey) {
            if (app.selection.includes(e.target)) app.unselect(e.target);
            else app.select(e.target);
          } else {
            app.unselectAll();
            app.select(e.target);
          }
        } else {
          app.unselectAll();
        }
      },
      onmousedown: function(e) {
        if (app.helpers.isEventSelecting(e) && !this.dragRef) {
//          app.unselectAll();
          //app.select(e.target);
          var rect = e.target.getBBox();
          this.dragRef = {
            el: e.target,
            x: e.data.x - rect.x,
            y: e.data.y - rect.y
          };
        }
      },
      onmousemove: function(e) {
        if (this.dragRef) {
          var box = this.dragRef.el.getBBox();
          box.x = e.data.x - this.dragRef.x;
          box.y = e.data.y - this.dragRef.y;
          this.dragRef.el.setBBox(box);
          if (app.selection.includes(this.dragRef.el)) { 
            this.dragRef.el.outline.update();
            app.updatePropertiesForm();
          }
        }
      },
      onmouseup: function(e) {
        this.dragRef = null;
      },
      ondragstart: function(e) {
        var el = e.target;
      }
    },
  
    rect: {
      STATE_SEL1: 0, // select first corner
      STATE_SEL2: 1, // select second corner
      el: null,
      p1: null,
      
      onmousedown: function(e) {
        if (app.toolState == this.STATE_SEL1) {
          this.p1 = e.data;
          app.toolState = this.STATE_SEL2;
        }
      },
      onmousemove: function(e) {
        if (app.toolState == this.STATE_SEL2) {
          var width = Math.abs(e.data.x - this.p1.x);
          var height = Math.abs(e.data.y - this.p1.y);
          
          if (!this.el) {
            if (width * height > 0) {
              this.el = app.helpers.createObject('rect'); 
            } else return;
          }
          
          if (e.ctrlKey) width = height = Math.min(width, height);
          
          this.el.setAttribute('width', width);
          this.el.setAttribute('height', height);
          this.el.setAttribute('x', e.data.x > this.p1.x ? this.p1.x : this.p1.x - width);
          this.el.setAttribute('y', e.data.y > this.p1.y ? this.p1.y : this.p1.y - height);
        }
      },
      onmouseup: function(e) {
          if (this.el) { // min area 1px2
            app.unselectAll();
            app.select(this.el);
            this.el = null;
          } else {
            
            if (app.helpers.isEventSelecting(e)) {
              app.tools.select.onclick(e);
            }
          }
          
          app.toolState = this.STATE_SEL1;
      },
      leave: function() {
        if (app.toolState == this.STATE_SEL2) app.remove(this.el);
      }
    }, // rect
    
    arc: {
      STATE_SEL_CENTER: 0,
      STATE_SEL_RADIUS: 1,
      el: null,
      
      onmousedown: function(e) {
        if (app.toolState == this.STATE_SEL_CENTER) {
          if (app.helpers.isEventSelecting(e)) {
            app.tools.select.onclick(e);
          } else {
            this.el = app.helpers.createObject('ellipse');
            this.p1 = e.data;
            app.unselectAll();
            app.select(this.el);
            app.toolState = this.STATE_SEL_RADIUS;
          }
        }
      },
      onmousemove: function(e) {
        if (app.toolState == this.STATE_SEL_RADIUS) {
          // TODO: This code is CONFUSING!!!
          
          var dx = (e.data.x - this.p1.x) * 0.5;
          var dy = (e.data.y - this.p1.y) * 0.5;
          
          if (e.ctrlKey) {
            var min = Math.min(Math.abs(dx), Math.abs(dy));
            dx *= Math.abs(min/dx);
            dy *= Math.abs(min/dy);
          }
          
          var center = {
            x: this.p1.x + dx,
            y: this.p1.y + dy
          };
          
          if (e.shiftKey) { center = this.p1 };
          
          var rx = Math.abs(dx);
          var ry = Math.abs(dy);
          
          this.el.setAttribute('cx', center.x);
          this.el.setAttribute('cy', center.y);
          this.el.setAttribute('rx', rx);
          this.el.setAttribute('ry', ry);
          this.el.outline.update();
        }
      },
      onmouseup: function(e) {
        if (app.toolState == this.STATE_SEL_RADIUS) {
          if (this.el.getAttribute('rx') * this.el.getAttribute('ry')  > 20) {
            app.toolState = this.STATE_SEL_CENTER;
            
            this.el = null;
          }
        }
      },
      leave: function() {
        if (app.toolState == this.STATE_SEL_RADIUS) app.remove(this.el);
      }
    }, // arc
    
    text: {
      STATE_SEL_ORIGIN: 0,
      STATE_TYPE_CONTENT: 1,
      el: null,
      inputEl: null,
      
      enter: function() {
        this.inputEl = document.createElement('input');
        this.inputEl.classList.add('hidden-input');
        this.inputEl.oninput = e => this.oninput(e);
        this.inputEl.onkeydown = e => { 
          if (e.key == "Enter") {
            app.unselect(this.el);
            this.blur();
            return false;
          }
        };
        app.$toolbar.appendChild(this.inputEl);
      },
      leave: function() {
        app.$toolbar.removeChild(this.inputEl);
        this.inputEl = null;
        if (app.toolState == this.STATE_TYPE_CONTENT) this.blur();
      },
      
      focus: function() { // should be called after selection
        this.inputEl.focus();
        this.inputEl.value = '';
        app.toolState = this.STATE_TYPE_CONTENT;
      },
      blur: function() { // should be called after unselection
        this.el = null;
        app.toolState = this.STATE_SEL_ORIGIN;
      },
      
      onmousedown: function(e) {
        if (!app.helpers.isEventSelecting(e)) {
          if (app.toolState == this.STATE_SEL_ORIGIN) {
            this.el = app.helpers.createObject('text');
            this.el.setAttribute('x', e.data.x);
            this.el.setAttribute('y', e.data.y);
            this.el.setAttribute('font-size', 20);
            this.el.setAttribute('stroke-width', 0);
            this.el.textContent = "(text)";
            this.focus();
            app.unselectAll();
            app.select(this.el);
          } else if (app.toolState == this.STATE_TYPE_CONTENT) {
            this.blur();
          }
        } else {
          // text element selected
          this.el = e.target;
          app.tools.select.onclick(e);
          this.focus();
        }
      },
      oninput: function(e) {
        if (e.key == "Enter") {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        if (app.toolState == this.STATE_TYPE_CONTENT) {
          this.el.textContent = e.target.value || '(text)';
          this.el.outline.update();
        }
      },
    }, // text
  }, // tools
  
  helpers: {
    isEventSelecting: function(e) {
      return !(e.target && e.target.nodeName == "svg");
    },
    
    createElement: function(type) {
      // same as document.createElement, but uses SVG namespace
      return document.createElementNS(app.$canvas.namespaceURI, type);
    },
    
    createObject: function(type) {
      var el = this.createElement(type);
      
      Object.keys(app.style).forEach( k => el.setAttribute(k, app.style[k]) );
      
      el.classList.add('object');
      el.origin = {x: null, y: null};
      
      app.$canvas.appendChild(el);
      return el;
    },
    
    createSelectionOutline: function(el) {
      
      var outline = app.helpers.createElement('rect');
      
      outline.classList.add('selection-outline');
      outline.target = el;
      
      outline.update = function() {
        var box = this.target.getBoundingClientRect();
        var pos = app.helpers.toCanvasCoords({x: box.left, y: box.top});
        if (!(box.width * box.height > 0)) return;
        
        var strokeWidth = 1;
        this.setAttribute('x', pos.x - strokeWidth);
        this.setAttribute('y', pos.y - strokeWidth);
        this.setAttribute('width', box.width + 2 * strokeWidth);
        this.setAttribute('height', box.height + 2 * strokeWidth);
      };
      
      outline.update();
      
      el.parentNode.appendChild(outline);
      
      
      /* this code creates a "tight fit" outline
      el.outline = el.cloneNode();
      
      el.updateOutline = function() {
        var box = this.getBBox();
        if (!(box.width * box.height > 0)) return;
        
        this.outline.classList = 'selection-outline';
        
        Array.from(this.attributes).forEach(attr => {
          this.outline.setAttribute(attr.name, attr.value);
        });
        
        var outlineWidth = 2*parseFloat(getComputedStyle(el.outline).strokeWidth);
        var scaleX = (box.width+2*outlineWidth)/box.width;
        var translateX = -outlineWidth - box.x*(scaleX-1);
        var translateY = -outlineWidth - box.y*(scaleX-1);
        this.outline.setAttribute('transform', 
          `matrix(${scaleX} 0 0 ${scaleX} ${translateX} ${translateY})`);
      }*/
      
      return outline;
    },
    
    dist: function(p1, p2) {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    },
    
    toCanvasCoords: function(pageCoords) { // pageCoords: Object
      var rect = app.$canvas.getBoundingClientRect();
      return {
        x: pageCoords.x - rect.left,
        y: pageCoords.y - rect.top
      };
    }
  },
  
  updatePropertiesForm: function(el) {
    el = app.selection[0];
  
    var f = document.forms.objectProperties;
    var box = el.getBoundingClientRect();
    var pos = app.helpers.toCanvasCoords({x: box.left, y: box.top});
    box.x = box.left;
    box.y = box.top;
    f.elements.x.value = pos.x.toFixed(1);
    f.elements.y.value = pos.y.toFixed(1);
    f.elements.width.value = box.width.toFixed(1);
    f.elements.height.value = box.height.toFixed(1);
    
    function parseColor(color) {
      var arr=[]; color.replace(/[\d+\.]+/g, function(v) { arr.push(parseFloat(v)); });
      return {
          hex: "#" + arr.slice(0, 3).map(int => {
            var hex = int.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
          }).join(""),
          opacity: arr.length == 4 ? arr[3] : 1
      };
    }
    
    var style = getComputedStyle(el);
    
    f.elements.fill.value = parseColor(style.fill).hex;
    f.elements.stroke.value = parseColor(style.stroke).hex;
    f.elements['stroke-width'].value = parseFloat(style.strokeWidth);
  },
  
  onload: function(e) {
    this.$canvas = document.getElementById('canvas');
    this.$aside = document.getElementById('aside');
    this.$toolbar = document.getElementById('toolbar');
    //this.$status = document.getElementById('status');
    
    this.tool = this.$toolbar.tool.value;
    
    // set tool event listeners
    [
      'click', 
      'mousedown', 'mouseup', 'mousemove',
      'touchstart', 'touchmove', 'touchend',
      'dragstart', 'dragstop',
    ].forEach(function(event) {
      app.$canvas.addEventListener(event, function(e) {
        if (e instanceof window.MouseEvent || e instanceof window.TouchEvent) {
          e.data = app.helpers.toCanvasCoords(e.pageCoords());
          
          if (event == 'touchstart') event = 'mousedown';
          if (event == 'touchend') event = 'mouseup';
          if (event == 'touchmove') event = 'mousemove';
        }
        
        var cb = 'on' + event;
        if (app.tool && app.tool[cb]) app.tool[cb](e);
        
        e.preventDefault();
        return false;
      });
    });
  },
  
  onkeypress: function(e) {
    var bindings = this.keyBindings;
    Object.keys(bindings).forEach(function(key) {
      if (
        (new RegExp('^([A-Z]+?[+]?)*'+e.key+'$')).test(key) &&
        //(!modNeeded || e.modKey) &&
        (key.indexOf('CTRL+')  == -1 || e.ctrlKey) &&
        (key.indexOf('SHIFT+') == -1 || e.shiftKey) &&
        (key.indexOf('ALT+')   == -1 || e.altKey) &&
        (key.indexOf('META+')  == -1 || e.metaKey))
      {
        e.stopPropagation();
        e.preventDefault();
        
        bindings[key](e);
        
        return false;
      }
    });
  },
  
};

window.onload = app.onload.bind(app);
window.onkeypress = app.onkeypress.bind(app);

app.handlers.style = function(e) {
  app.style[e.target.name] = e.target.value;
  app.selection.forEach(function(el) {
    console.log(e.target.name, '=>', e.target.value);
    el.setAttribute(e.target.name, e.target.value);
    el.outline.update(); 
  });  
};

app.handlers.x = function(e) {
  app.selection.forEach(function(el) {
    var box = el.getBBox();
    box.x = e.target.value;
    el.setBBox(box);
    el.outline.update();
  });
}

app.handlers.y = function(e) {
  app.selection.forEach(function(el) {
    var box = el.getBBox();
    box.y = e.target.value;
    el.setBBox(box);
    el.outline.update();
  });
}

app.handlers.width = function(e) {
  app.selection.forEach(function(el) {
    if (!(e.target.value > 0)) return;
    var box = el.getBBox();
    box.width = e.target.value;
    el.setBBox(box);
    el.outline.update();
  });
}

app.handlers.height = function(e) {
  app.selection.forEach(function(el) {
    if (!(e.target.value > 0)) return;
    var box = el.getBBox();
    box.height = e.target.value;
    el.setBBox(box);
    el.outline.update();
  });
}

SVGRectElement.prototype.setBBox = function(newBBox) {
  this.setAttribute('x', newBBox.x);
  this.setAttribute('y', newBBox.y);
  this.setAttribute('width', newBBox.width);
  this.setAttribute('height', newBBox.height);
}

SVGEllipseElement.prototype.setBBox = function(newBBox) {
  var rx = newBBox.width * 0.5;
  var ry = newBBox.height * 0.5;
  
  var cx = newBBox.x + rx;
  var cy = newBBox.y + ry;
  
  this.setAttribute('rx', rx);
  this.setAttribute('ry', ry);
  this.setAttribute('cx', cx);
  this.setAttribute('cy', cy);
}

SVGTextElement.prototype.setBBox = function(newBBox) {
  var box = this.getBBox();
  var x = newBBox.x;
  var y = newBBox.y;

  var scaleX = newBBox.width / box.width;
  var scaleY = newBBox.height / box.height;
  
  /*if (this.getAttribute('transform')) {
    var match = el.getAttribute('transform').match(/scale\((.+?)\s+(.+?)\)/);
    scaleX = match[1];
    scaleY = match[2];
  }*/
  
  this.setAttribute('x', x);
  this.setAttribute('y', y);
  this.setAttribute('transform', ``+
    `translate(${x+box.width/2} ${y+box.height/2}) `+ 
    `scale(${scaleX} ${scaleY}) `+ 
    `translate(${-x-box.width/2} ${-y-box.height/2})`);
  
  
  
}

function CubicBezierObject(start, control1, control2, end) {
  var el = app.helpers.createElement('path');
  
  var updatePath = function() {
    el.setAttribute('d', 
      `M ${start.x} ${start.y} ` + 
      `C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`);
  }
  
  updatePath();
  
  return {
    el,
    update: updatePath,
    
    get start() { return start; },
    set start(v) { start = v; updatePath(); },
    
    get control1() { return control1; },
    set control1(v) { control1 = v; updatePath(); },
    
    get control2() { return control2; },
    set control2(v) { control2 = v; updatePath(); },
    
    get end() { return end; },
    set end(v) { end = v; updatePath(); },
    
  };
}
