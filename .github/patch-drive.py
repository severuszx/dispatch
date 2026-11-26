p = 'play/index.html'
h = open(p).read()
card = '''      <a class="mg-card drive" href="3d/drive.html">
        <div class="mg-card-top"><span class="mg-no mono">03 / DRIVE</span><span class="mg-tag">3D</span></div>
        <h2>HXD3D 自由驾驶</h2>
        <p class="mg-desc">宁西线 Z595，信阳至西安。HXD3D 单机牵引 18 辆 25T，司机室 36 个可操作开关，受电弓、主断、牵引、制动、监控全部接入。</p>
        <ul class="mg-list">
          <li><span class="mono">A</span>驾驶室 / 操纵台 / 外部视角</li>
          <li><span class="mono">B</span>36 个开关与两套手柄</li>
          <li><span class="mono">C</span>宁西线站场、接触网、地形与光影</li>
        </ul>
        <span class="mg-go">坐进司机室 <i>→</i></span>
      </a>
'''
if 'HXD3D 自由驾驶' not in h:
    h = h.replace('<style>.mg-3d{', '<style>.mode-gate{align-items:flex-start;overflow-y:auto}.mg-card.drive{grid-column:1/-1;min-height:210px;text-decoration:none}.mg-card.drive::before{background:#3d6b82}.mg-card.drive:hover{background:#121c22}.mg-3d{')
    h = h.replace('        <span class="mg-go">进入站长台 <i>→</i></span>\n      </button>\n    </div>', '        <span class="mg-go">进入站长台 <i>→</i></span>\n      </button>\n' + card + '    </div>')
open(p, 'w').write(h)
print('drive entry patched')
