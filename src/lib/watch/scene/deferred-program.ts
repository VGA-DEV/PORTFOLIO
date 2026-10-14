import { Program } from 'ogl';

/**
 * A program whose compile is started without waiting for the result, so the GPU
 * driver can compile every shader in parallel while the page stays responsive.
 * Call `finish()` once `KHR_parallel_shader_compile` reports completion.
 */
export class DeferredProgram extends Program {
  override setShaders({ vertex, fragment }: { vertex?: string; fragment?: string }) {
    const gl = this.gl;
    if (vertex) {
      gl.shaderSource(this.vertexShader, vertex);
      gl.compileShader(this.vertexShader);
    }
    if (fragment) {
      gl.shaderSource(this.fragmentShader, fragment);
      gl.compileShader(this.fragmentShader);
    }
    gl.linkProgram(this.program);
  }

  /** Read back the result and look up uniform and attribute locations, as OGL does. */
  finish() {
    const gl = this.gl;
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(this.program));
      return;
    }
    const self = this as unknown as {
      uniformLocations: Map<unknown, unknown>;
      attributeLocations: Map<unknown, number>;
      attributeOrder: string;
    };
    self.uniformLocations = new Map();
    const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniform = gl.getActiveUniform(this.program, i) as
        | (WebGLActiveInfo & { uniformName: string; nameComponents: string[] })
        | null;
      if (!uniform) continue;
      self.uniformLocations.set(uniform, gl.getUniformLocation(this.program, uniform.name));
      const split = uniform.name.match(/(\w+)/g) ?? [uniform.name];
      uniform.uniformName = split[0];
      uniform.nameComponents = split.slice(1);
    }
    self.attributeLocations = new Map();
    const order: string[] = [];
    const attributeCount = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < attributeCount; i++) {
      const attribute = gl.getActiveAttrib(this.program, i);
      if (!attribute) continue;
      const location = gl.getAttribLocation(this.program, attribute.name);
      if (location === -1) continue;
      order[location] = attribute.name;
      self.attributeLocations.set(attribute, location);
    }
    self.attributeOrder = order.join('');
  }
}
