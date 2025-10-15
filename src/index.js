import * as dat from "dat.gui";
import { mat4 } from "gl-matrix";

// Vertex shader source
const vertexShaderSource = `#version 300 es
precision mediump float;

      #define MAX_LIGHTS 5
      in vec3 aCoordinates;

      // Array with light coordinates representes as vec4
      uniform vec4 uLightsCoordinates[MAX_LIGHTS];

      // Boolean value that indicates if light should be in a fixes position or rotate with the scene
      uniform bool uFixedLights;

      // Array of int that indicates which lights should be rendered
      uniform int uShowLights[5];

      // Model and view matrixes
      uniform mat4 uModelMatrix;
      uniform mat4 uViewMatrix;

      // Normal vector for vertices
      in vec3 aVertexNormals;

      out vec3 vNormal;
      out vec3 vEyeVector;
      out vec3 vLightDirections[5];

      void main(void) {
        // saving vertex after transformations BEFORE PERSPECTIVE
        vec4 vertex = uModelMatrix * vec4(aCoordinates, 1.0);
        gl_Position = uViewMatrix * vertex;

        // compute normal vector
        vNormal = vec3(uModelMatrix * vec4(aVertexNormals, 0.0));

        // compute vector from vertex to viewer
        vEyeVector = -vertex.xyz;
        // compute vector from vertex to light

        // Compute light directions
        for(int i = 0; i < MAX_LIGHTS; i++) {
          vec4 light = uLightsCoordinates[i];

          if (!uFixedLights) {
            light = uModelMatrix * light;
          }

          if (uShowLights[i] == 0) {
            vLightDirections[i] = vec3(999.0, 999.0, 999.0);
          }
          else {
            vLightDirections[i] = light.xyz - vertex.xyz;
          } 
        }
      }
`;

// Fragment shader source
const fragmentShaderSource = `#version 300 es
precision mediump float;

#define MAX_LIGHTS 5
out vec4 fragColor;

// Color value for the three types of light
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform vec3 uAmbientColor;

// Shininess value for specular light
uniform float uShininess;

// Coefficients that allow to control intensity of light
uniform float uAmbientCoefficient;
uniform float uDiffuseCoefficient;
uniform float uSpecularCoefficient;

in vec3 vNormal;
in vec3 vEyeVector;
in vec3 vLightDirections[5];

void main(void) {
  vec4 lightSum = vec4(0, 0, 0, 1);

  // Compute specular and diffuse component of each light
  // then add the two values to the already computed components
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (vLightDirections[i].x <= 15.0) {
      // computing diffuse component
      vec3 N = normalize(vNormal);
      vec3 L = normalize(vLightDirections[i]);
      vec3 diffuseMaterial = uDiffuseColor;
      float diffuse = max(dot(N, L), 0.0);
      vec4 Idif = vec4(uDiffuseCoefficient * diffuse * diffuseMaterial,1);

      // compute specular component
      float NL = dot(N,L);
      vec4 Ispec = vec4(0,0,0,1);
      if (NL>0.0) {
        vec3 R = 2.0*N*NL-L;
        vec3 specularMaterial = uSpecularColor;
        vec3 V = normalize(vEyeVector);
        float specular = pow(max(dot(R, V), 0.0), uShininess);
        Ispec = vec4(uSpecularCoefficient * specular * specularMaterial, 1);
      }
      lightSum += Idif + Ispec;
    }
  }

  // computing ambient component
  vec4 Iamb = vec4(uAmbientCoefficient * uAmbientColor,1);
  lightSum += Iamb;
  
  // calculamos color final
  fragColor = lightSum;
  fragColor = min(fragColor, vec4(1,1,1,1));
  }
`;

var canvas, gl;
var vertex_buffer;
var modelMatrixLoc;
var modelMatrix;
var index_buffer;
var rotateX = 0,
  rotateY = 0;
var mouseX, mouseY;
var zoomFactor = 1;
var viewMatrixLoc;
var normalsLoc;
var normal_buffer;
var lightsCoordinatesLoc;
var fixedLightsLoc;
var diffuseColorLoc, specularColorLoc, ambientColorLoc;
var shininessLoc;
var ambientCoefficientLoc, diffuseCoefficientLoc, specularCoefficientLoc;
var showLightsLoc;

var lights = [
  [10, 10, 10],
  [-10, -10, -10],
  [5, 5, 5],
  [-5, -5, 5],
  [0, 0, 0]
]

var showLight = [true, false, false, false, false];

var settings = {
  lightPositionX: 10.0,
  lightPositionY: 10.0,
  lightPositionZ: 10.0,
  
  fixedLights: true,
  shininess: 10.0,
  
  diffuseColor: "#00ff00",
  specularColor: "#ff0000",
  ambientColor: "#0000ff",
  backgroundColor: "#ff7777",
  
  ambientCoefficient: 1.0,
  diffuseCoefficient: 1.0,
  specularCoefficient: 1.0,

  selectedLight: 1,
  showLight: true
};

var matrixStack = [];
function glPushMatrix() {
  const matrix = mat4.create();
  mat4.copy(matrix, modelMatrix);
  matrixStack.push(matrix);
}

function glPopMatrix() {
  modelMatrix = matrixStack.pop();
}

function init() {
  // ============ STEP 1: Creating a canvas=================
  canvas = document.getElementById("my_Canvas");
  gl = canvas.getContext("webgl2");

  gl.enable(gl.DEPTH_TEST);

  // create GUI
  var gui = new dat.GUI();

  const lightPositionXSelector = gui.add(settings, "lightPositionX", -10.0, 10.0, 0.01).onChange(function(value) {
    lights[settings.selectedLight - 1][0] = value;
  });

  const lightPositionYSelector = gui.add(settings, "lightPositionY", -10.0, 10.0, 0.01).onChange(function(value) {
    lights[settings.selectedLight - 1][1] = value;
  });

  const lightPositionZSelector = gui.add(settings, "lightPositionZ", -10.0, 10.0, 0.01).onChange(function(value) {
    lights[settings.selectedLight - 1][2] = value;
  });

  const showLightSelector = gui.add(settings, "showLight").onChange(function(value) {
    showLight[settings.selectedLight - 1] = value;
  });

  gui.add(settings, "selectedLight", [1, 2, 3, 4, 5]).onChange(function(value) {
    settings.lightPositionX = lights[value - 1][0];
    settings.lightPositionY = lights[value - 1][1];
    settings.lightPositionZ = lights[value - 1][2];
    settings.showLight = showLight[value - 1];
    
    lightPositionXSelector.updateDisplay();
    lightPositionYSelector.updateDisplay();
    lightPositionZSelector.updateDisplay();
    showLightSelector.updateDisplay();
  });
  gui.add(settings, "fixedLights");
  gui.add(settings, "shininess", 1, 100, 1);
  gui.addColor(settings, "diffuseColor");
  gui.addColor(settings, "specularColor");
  gui.addColor(settings, "ambientColor");
  gui.addColor(settings, "backgroundColor");
  gui.add(settings, "ambientCoefficient", 0.0, 1.0, 0.1);
  gui.add(settings, "diffuseCoefficient", 0.0, 1.0, 0.1);
  gui.add(settings, "specularCoefficient", 0.0, 1.0, 0.1);

  /*
  // Posicionar el GUI debajo del canvas
  const canvasRect = canvas.getBoundingClientRect();
  gui.domElement.style.position = "absolute";
  gui.domElement.style.top = canvasRect.bottom + window.scrollY + 20 + "px";
  gui.domElement.style.left =
    canvasRect.left +
    window.scrollX +
    (canvasRect.width - gui.domElement.offsetWidth) / 2 +
    "px";
  */

  //========== STEP 2: Create and compile shaders ==========

  // Create a vertex shader object
  const vertShader = gl.createShader(gl.VERTEX_SHADER);

  // Attach vertex shader source code
  gl.shaderSource(vertShader, vertexShaderSource);

  // Compile the vertex shader
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log("vertShader: " + gl.getShaderInfoLog(vertShader));
  }

  // Create fragment shader object
  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);

  // Attach fragment shader source code
  gl.shaderSource(fragShader, fragmentShaderSource);

  // Compile the fragmentt shader
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log("fragShader: " + gl.getShaderInfoLog(fragShader));
  }

  // Create a shader program object to store
  // the combined shader program
  const shaderProgram = gl.createProgram();

  // Attach a vertex shader
  gl.attachShader(shaderProgram, vertShader);

  // Attach a fragment shader
  gl.attachShader(shaderProgram, fragShader);

  // Link both programs
  gl.linkProgram(shaderProgram);

  // Use the combined shader program object
  gl.useProgram(shaderProgram);

  //======== STEP 3: Create buffer objects and associate shaders ========

  // Create an empty buffer object to store the vertex buffer
  vertex_buffer = gl.createBuffer();

  // create index buffer
  index_buffer = gl.createBuffer();

  // Create normal buffer
  normal_buffer = gl.createBuffer();

  // Bind vertex buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

  // Get the attribute location
  const coordLocation = gl.getAttribLocation(shaderProgram, "aCoordinates");

  // Point an attribute to the currently bound VBO
  gl.vertexAttribPointer(coordLocation, 3, gl.FLOAT, false, 0, 0);

  // Enable the attribute
  gl.enableVertexAttribArray(coordLocation);

  // Unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // look up uniform locations
  modelMatrixLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  viewMatrixLoc = gl.getUniformLocation(shaderProgram, "uViewMatrix");
  normalsLoc = gl.getAttribLocation(shaderProgram, "aVertexNormals");
  lightsCoordinatesLoc = gl.getUniformLocation(shaderProgram, "uLightsCoordinates");
  fixedLightsLoc = gl.getUniformLocation(shaderProgram, "uFixedLights");
  diffuseColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
  specularColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularColor");
  ambientColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientColor");
  shininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");
  ambientCoefficientLoc = gl.getUniformLocation(shaderProgram, "uAmbientCoefficient");
  diffuseCoefficientLoc = gl.getUniformLocation(shaderProgram, "uDiffuseCoefficient");
  specularCoefficientLoc = gl.getUniformLocation(shaderProgram, "uSpecularCoefficient");
  showLightsLoc = gl.getUniformLocation(shaderProgram, "uShowLights");

  gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
  gl.vertexAttribPointer(normalsLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(normalsLoc);
}

function render() {
  //========= STEP 4: Create the geometry and draw ===============

  // Clear the canvas
  const backgroundColorRGB = hexToRgb(settings.backgroundColor);
  gl.clearColor(
    backgroundColorRGB[0], 
    backgroundColorRGB[1], 
    backgroundColorRGB[2], 
    1.0);

  // Clear the color buffer bit
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Set the view port
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Bind appropriate array buffer to it
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

  // perspective
  const viewMatrix = mat4.create();
  mat4.perspective(
    viewMatrix,
    Math.PI / 4, // vertical opening angle
    1, // ratio width-height
    0.5, // z-near
    30 // z-far
  );
  gl.uniformMatrix4fv(viewMatrixLoc, false, viewMatrix);

  // Set the model Matrix.
  modelMatrix = mat4.create();
  mat4.identity(modelMatrix);

  const eye = [0, 0, 3];
  const center = [0, 0, 0];
  mat4.lookAt(modelMatrix, eye, center, [0, 1, 0]);

  // mouse transformations
  mat4.scale(modelMatrix, modelMatrix, [zoomFactor, zoomFactor, zoomFactor]);
  mat4.rotateX(modelMatrix, modelMatrix, rotateX);
  mat4.rotateY(modelMatrix, modelMatrix, rotateY);
  // drawGround
  //renderGround(9, 10);

  let lightCoordinatesArray = [];

  for (let light of lights) {
    for (let coordinate of light) {
      lightCoordinatesArray.push(coordinate);
    }
    lightCoordinatesArray.push(1);
  }

  gl.uniform4fv(lightsCoordinatesLoc, new Float32Array(lightCoordinatesArray));

  let showLightsArray = [];

  for (let light of showLight) {
    showLightsArray.push(light ? 1 : 0);
  }

  gl.uniform1iv(showLightsLoc, new Int32Array(showLightsArray));

  gl.uniform3fv(diffuseColorLoc, hexToRgb(settings.diffuseColor));
  gl.uniform3fv(specularColorLoc, hexToRgb(settings.specularColor));
  gl.uniform3fv(ambientColorLoc, hexToRgb(settings.ambientColor));

  gl.uniform1i(fixedLightsLoc, settings.fixedLights);

  gl.uniform1f(shininessLoc, settings.shininess);

  gl.uniform1f(ambientCoefficientLoc, settings.ambientCoefficient);
  gl.uniform1f(diffuseCoefficientLoc, settings.diffuseCoefficient);
  gl.uniform1f(specularCoefficientLoc, settings.specularCoefficient);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
  renderSphere(20);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
  for (let i = 0; i < lights.length; i++) {
    if (showLight[i]) {
      renderLightSphere(20, lights[i]);
    }
  }
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


  // Unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  //document.getElementById("debug").textContent = "y = " + player1.y.toFixed(2);

  // start animation loop
  window.requestAnimationFrame(render);
}

function renderCube() {
  glPushMatrix();
  mat4.translate(modelMatrix, modelMatrix, [-0.5, -0.5, -0.5]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  // create vertices
  const arrayV = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, arrayV, gl.STATIC_DRAW);

  /*
  // create edges
  const arrayI = new Uint16Array([
    0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
  ]);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrayI, gl.STATIC_DRAW);
  // draw cube
  gl.uniform4fv(colorLocation, [0, 0, 0, 1]);
  gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);
  */

  // create faces
  const arrayF = new Uint16Array([
    1,
    0,
    3,
    1,
    3,
    2, // cara trasera
    4,
    5,
    6,
    4,
    6,
    7, // cara delantera
    7,
    6,
    2,
    7,
    2,
    3, // cara superior
    0,
    1,
    5,
    0,
    5,
    4, // cara inferior
    5,
    1,
    2,
    5,
    2,
    6, // cara derecha
    0,
    4,
    7,
    0,
    7,
    3, // cara izquierda
  ]);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrayF, gl.STATIC_DRAW);
  // draw cube
  gl.uniform4fv(colorLocation, [0.3, 0.5, 1, 1]);
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
  glPopMatrix();
}

function renderSphere(n) {
  glPushMatrix();
  mat4.scale(modelMatrix, modelMatrix, [0.7, 0.7, 0.7]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  // compute vertices
  const coords = new Float32Array(6 * n * n);
  const step = Math.PI / n;
  const R = 1;
  var k = 0;
  for (let i = 1; i < n; i++) {
    const tita = -Math.PI / 2 + i * step;
    for (let j = 0; j < 2 * n; j++) {
      const alpha = j * step;
      coords[k++] = R * Math.cos(tita) * Math.cos(alpha);
      coords[k++] = R * Math.cos(tita) * Math.sin(alpha);
      coords[k++] = R * Math.sin(tita);
    }
  }

  // compute normals
  const normals = coords;

  // compute faces
  const arrayIFaces = new Uint16Array((4 * n + 2) * n);
  var k = 0;
  for (let i = 0; i < n - 2; i++) {
    for (let j = 0; j < 2 * n; j++) {
      arrayIFaces[k++] = 2 * n * (i + 1) + j;
      arrayIFaces[k++] = 2 * n * i + j;
    }
    arrayIFaces[k++] = 2 * n * (i + 1);
    arrayIFaces[k++] = 2 * n * i;
  }

  // pass data to GPU
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrayIFaces, gl.STATIC_DRAW);

  // draw meshes
  for (let i = 0; i < n - 2; i++)
    gl.drawElements(
      gl.TRIANGLE_STRIP,
      4 * n + 2,
      gl.UNSIGNED_SHORT,
      2 * i * (4 * n + 2)
    );
  glPopMatrix();
}

// CÓDIGO PRINCIPAL
init();
render();

// add mouse handlers
document.onmousedown = onMouseDown;
document.onmousemove = onMouseMove;
document.onwheel = zoom;

function onMouseDown(e) {
  if (e.buttons == 1 && e.srcElement == canvas) {
    mouseX = e.pageX;
    mouseY = e.pageY;
  }
}

function onMouseMove(e) {
  if (e.buttons == 1 && e.srcElement == canvas) {
    rotateY = rotateY + (e.pageX - mouseX) * 0.01;
    rotateX = rotateX + (e.pageY - mouseY) * 0.01;
    mouseX = e.pageX;
    mouseY = e.pageY;
    //console.log("move = ("+mouseX+","+mouseY+")");
  }
}

function zoom(e) {
  if (e.deltaY < 0) zoomFactor *= 1.1;
  else zoomFactor *= 0.9;
}

function hexToRgb(hex) {
  // Elimina el signo "#" si está presente
  hex = hex.replace(/^#/, '');

  // Divide el valor hexadecimal en sus componentes RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Devuelve un objeto con los valores RGB normalizados
  return [r, g, b];
}

function renderLightSphere(n, position) {
  glPushMatrix();

  if (settings.fixedLights) {
    mat4.identity(modelMatrix);
  }

  mat4.translate(modelMatrix, modelMatrix, position);
  mat4.scale(modelMatrix, modelMatrix, [0.1, 0.1, 0.1]);

  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);

  gl.uniform4fv(lightsCoordinatesLoc, [
    settings.lightPositionX, 
    settings.lightPositionY, 
    settings.lightPositionZ, 
    1
  ]);

  gl.uniform3fv(diffuseColorLoc, [0, 0, 0]);
  gl.uniform3fv(specularColorLoc, [0, 0, 0]);
  gl.uniform3fv(ambientColorLoc, [1, 1, 1]);

  renderSphere(n);

  glPopMatrix();
}