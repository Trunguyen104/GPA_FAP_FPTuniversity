/**
 * FAP GPA Calculator - Content Script
 * Supports FAP FPT University Transcript page (/Report/Transcript)
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__FAP_GPA_CALCULATOR_LOADED__) return;
  window.__FAP_GPA_CALCULATOR_LOADED__ = true;

  // State
  let config = {
    excludeVOV: true,
    includeOJT: true,
    includeOutside: false,
    collapsed: false,
    activeTab: 'semesters',
    customDisabledCodes: []
  };

  let parsedData = {
    curriculumCourses: [],
    outsideCourses: [],
    allSemesters: [],
    inProgressCourses: [],
    futureCourses: []
  };

  let simulatedGrades = {};

  // Load config from chrome.storage
  function loadConfig(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['fgpa_config'], function (result) {
        if (result && result.fgpa_config) {
          config = Object.assign(config, result.fgpa_config);
        }
        callback();
      });
    } else {
      callback();
    }
  }

  function saveConfig() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ fgpa_config: config });
    }
  }

  // Helper: Convert Vietnamese decimal string '8,6' -> 8.6
  function parseGrade(text) {
    if (!text) return null;
    const clean = text.trim().replace(',', '.');
    if (clean === '-' || clean === '') return null;
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }

  // Convert 10.0 scale to 4.0 scale
  function toScale4(grade10) {
    if (grade10 === null || isNaN(grade10)) return null;
    if (grade10 >= 9.0) return 4.0;
    if (grade10 >= 8.5) return 3.7;
    if (grade10 >= 8.0) return 3.5;
    if (grade10 >= 7.0) return 3.0;
    if (grade10 >= 6.5) return 2.5;
    if (grade10 >= 5.5) return 2.0;
    if (grade10 >= 5.0) return 1.5;
    if (grade10 >= 4.0) return 1.0;
    return 0.0;
  }

  // Xếp loại học lực
  function getClassification(gpa) {
    if (gpa >= 9.0) return { title: 'Xuất sắc', class: 'success', icon: '🌟' };
    if (gpa >= 8.0) return { title: 'Giỏi', class: 'primary', icon: '🏆' };
    if (gpa >= 7.0) return { title: 'Khá', class: 'info', icon: '🎯' };
    if (gpa >= 5.0) return { title: 'Trung bình', class: 'warning', icon: '📘' };
    return { title: 'Yếu / Chưa đạt', class: 'danger', icon: '⚠️' };
  }

  // Extract cell text by multiple possible data-labels or dynamic header index
  function getCell(row, labels, fallbackIndex) {
    if (typeof labels === 'string') labels = [labels];
    for (const label of labels) {
      const td = row.querySelector(`td[data-label="${label}" i]`);
      if (td) return td.textContent.trim();
    }
    const cells = row.querySelectorAll('td');
    if (fallbackIndex !== undefined && fallbackIndex !== -1 && cells[fallbackIndex]) {
      return cells[fallbackIndex].textContent.trim();
    }
    return '';
  }

  // Scrape tables
  function scrapeData() {
    parsedData.curriculumCourses = [];
    parsedData.outsideCourses = [];
    parsedData.inProgressCourses = [];
    parsedData.futureCourses = [];

    // Find main curriculum table (first fap-sheet or inside card)
    const tables = document.querySelectorAll('table.fap-sheet, table.table');
    if (!tables || tables.length === 0) return false;

    const mainTable = tables[0];
    
    // Map headers dynamically from thead
    const headerMap = {
      stt: 0,
      term: 1,
      semester: 2,
      code: 3,
      prereq: 4,
      replacement: 5,
      name: 6,
      credits: 7,
      grade: 8,
      status: 9
    };

    mainTable.querySelectorAll('thead th').forEach((th, idx) => {
      const txt = th.textContent.trim().toUpperCase();
      if (txt.includes('STT') || txt.includes('NO.')) headerMap.stt = idx;
      else if (txt === 'KỲ' || txt === 'TERM') headerMap.term = idx;
      else if (txt.includes('HỌC KỲ') || txt.includes('SEMESTER')) headerMap.semester = idx;
      else if (txt.includes('MÃ MÔN') || txt.includes('SUBJECT CODE') || txt.includes('CODE')) headerMap.code = idx;
      else if (txt.includes('TIÊN QUYẾT') || txt.includes('PREREQUISITE')) headerMap.prereq = idx;
      else if (txt.includes('THAY THẾ') || txt.includes('REPLACEMENT')) headerMap.replacement = idx;
      else if (txt.includes('TÊN MÔN') || txt.includes('SUBJECT NAME') || txt.includes('NAME')) headerMap.name = idx;
      else if (txt.includes('TÍN CHỈ') || txt.includes('CREDIT')) headerMap.credits = idx;
      else if (txt.includes('ĐIỂM') || txt.includes('GRADE') || txt.includes('MARK')) headerMap.grade = idx;
      else if (txt.includes('TRẠNG THÁI') || txt.includes('STATUS')) headerMap.status = idx;
    });

    const mainRows = mainTable.querySelectorAll('tbody tr');

    mainRows.forEach((row, idx) => {
      const code = getCell(row, ['MÃ MÔN', 'SUBJECT CODE', 'CODE'], headerMap.code);
      if (!code) return;

      const stt = getCell(row, ['STT', 'NO', 'NO.'], headerMap.stt);
      const term = getCell(row, ['KỲ', 'TERM'], headerMap.term);
      const semester = getCell(row, ['HỌC KỲ', 'SEMESTER'], headerMap.semester);
      const prereq = getCell(row, ['TIÊN QUYẾT', 'PREREQUISITE'], headerMap.prereq);
      const replacement = getCell(row, ['MÔN THAY THẾ', 'REPLACEMENT'], headerMap.replacement);
      const name = getCell(row, ['TÊN MÔN', 'SUBJECT NAME', 'NAME'], headerMap.name);
      const creditsStr = getCell(row, ['TÍN CHỈ', 'CREDIT', 'CREDITS'], headerMap.credits);
      const gradeStr = getCell(row, ['ĐIỂM', 'GRADE', 'MARK'], headerMap.grade);
      const status = getCell(row, ['TRẠNG THÁI', 'STATUS'], headerMap.status);

      const credits = parseInt(creditsStr, 10) || 0;
      const grade = parseGrade(gradeStr);
      const statusLower = status.toLowerCase();
      const isPassed = (statusLower.includes('đạt') && !statusLower.includes('không')) || statusLower.includes('passed') || statusLower === 'pass';
      const isInProgress = statusLower.includes('đang học') || statusLower.includes('studying') || statusLower.includes('in progress');
      const isFailed = statusLower.includes('không đạt') || statusLower.includes('fail');
      const isVOV = code.toUpperCase().startsWith('VOV');
      const isGDQP = code.toUpperCase().includes('GDQP');
      const isOJT = code.toUpperCase().startsWith('OJT');

      const courseObj = {
        stt,
        term,
        semester: semester === '-' || !semester ? 'Chưa xác định' : semester,
        code,
        prereq,
        replacement,
        name,
        credits,
        grade,
        status,
        isPassed,
        isInProgress,
        isFailed,
        isVOV,
        isGDQP,
        isOJT,
        isOutside: false
      };

      parsedData.curriculumCourses.push(courseObj);

      if (isInProgress) {
        parsedData.inProgressCourses.push(courseObj);
      } else if (!isPassed && !isFailed && credits > 0) {
        parsedData.futureCourses.push(courseObj);
      }
    });

    // Check second table: Môn ngoài khung chương trình
    if (tables.length > 1) {
      const outsideTable = tables[1];
      const outsideRows = outsideTable.querySelectorAll('tbody tr');
      outsideRows.forEach((row) => {
        const code = getCell(row, ['MÃ MÔN', 'SUBJECT CODE', 'CODE'], 2);
        if (!code) return;
        const stt = getCell(row, ['STT', 'NO', 'NO.'], 0);
        const semester = getCell(row, ['HỌC KỲ', 'SEMESTER'], 1);
        const name = getCell(row, ['TÊN MÔN', 'SUBJECT NAME', 'NAME'], 3);
        const creditsStr = getCell(row, ['TÍN CHỈ', 'CREDIT', 'CREDITS'], 4);
        const gradeStr = getCell(row, ['ĐIỂM', 'GRADE', 'MARK'], 5);
        const status = getCell(row, ['TRẠNG THÁI', 'STATUS'], 6);

        const credits = parseInt(creditsStr, 10) || 0;
        const grade = parseGrade(gradeStr);
        const statusLower = status.toLowerCase();
        const isPassed = (statusLower.includes('đạt') && !statusLower.includes('không')) || statusLower.includes('passed') || statusLower === 'pass';

        parsedData.outsideCourses.push({
          stt,
          term: 'Ngoài',
          semester: semester || 'Ngoài CTĐT',
          code,
          name,
          credits,
          grade,
          status,
          isPassed,
          isInProgress: status.toLowerCase().includes('đang học'),
          isFailed: status.toLowerCase().includes('fail'),
          isVOV: code.toUpperCase().startsWith('VOV'),
          isGDQP: code.toUpperCase().includes('GDQP'),
          isOJT: code.toUpperCase().startsWith('OJT'),
          isOutside: true
        });
      });
    }

    return parsedData.curriculumCourses.length > 0;
  }

  // Determine if a course should be included in GPA
  function shouldIncludeCourse(course) {
    if (config.customDisabledCodes.includes(course.code)) return false;
    if (course.isOutside && !config.includeOutside) return false;
    if (course.isVOV && config.excludeVOV) return false;
    if (course.isGDQP) return false; // GDQP has 0 credits anyway
    if (course.isOJT && !config.includeOJT) return false;
    if (course.credits <= 0) return false;
    return true;
  }

  // Calculate Cumulative GPA & Stats
  function calculateStats() {
    let allApplicable = [...parsedData.curriculumCourses];
    if (config.includeOutside) {
      allApplicable = allApplicable.concat(parsedData.outsideCourses);
    }

    let totalPoints10 = 0;
    let totalPoints4 = 0;
    let gradedCredits = 0;
    let totalPassedCredits = 0;
    let totalCurriculumCredits = 0;

    // Track semesters
    const semesterMap = {};

    parsedData.curriculumCourses.forEach(c => {
      if (c.credits > 0) {
        totalCurriculumCredits += c.credits;
      }
      if (c.isPassed && c.credits > 0) {
        totalPassedCredits += c.credits;
      }
    });

    allApplicable.forEach(c => {
      const semKey = c.semester;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = {
          semester: semKey,
          courses: [],
          totalCredits: 0,
          gradedCredits: 0,
          points10: 0,
          points4: 0
        };
      }
      semesterMap[semKey].courses.push(c);

      const include = shouldIncludeCourse(c);
      if (include && c.grade !== null && c.credits > 0) {
        const grade4 = toScale4(c.grade);
        totalPoints10 += c.grade * c.credits;
        totalPoints4 += grade4 * c.credits;
        gradedCredits += c.credits;

        semesterMap[semKey].points10 += c.grade * c.credits;
        semesterMap[semKey].points4 += grade4 * c.credits;
        semesterMap[semKey].gradedCredits += c.credits;
      }

      if (c.credits > 0) {
        semesterMap[semKey].totalCredits += c.credits;
      }
    });

    const gpa10 = gradedCredits > 0 ? (totalPoints10 / gradedCredits) : 0;
    const gpa4 = gradedCredits > 0 ? (totalPoints4 / gradedCredits) : 0;
    const classification = getClassification(gpa10);

    // Compute semester GPAs and running cumulative GPA
    const semesterList = Object.values(semesterMap).filter(s => s.semester !== 'Chưa xác định');
    
    // Sort semesters chronologically if possible
    const semWeights = { 'spring': 1, 'summer': 2, 'fall': 3 };
    semesterList.sort((a, b) => {
      const parseSem = (str) => {
        const match = str.match(/([a-zA-Z]+)(\d{4})/i);
        if (!match) return 0;
        const term = match[1].toLowerCase();
        const year = parseInt(match[2], 10);
        return year * 10 + (semWeights[term] || 0);
      };
      return parseSem(a.semester) - parseSem(b.semester);
    });

    let runningPoints = 0;
    let runningCredits = 0;
    semesterList.forEach(sem => {
      sem.semGpa10 = sem.gradedCredits > 0 ? (sem.points10 / sem.gradedCredits) : null;
      sem.semGpa4 = sem.gradedCredits > 0 ? (sem.points4 / sem.gradedCredits) : null;
      runningPoints += sem.points10;
      runningCredits += sem.gradedCredits;
      sem.cumGpa10 = runningCredits > 0 ? (runningPoints / runningCredits) : null;
    });

    // Simulator calculation
    let simTotalPoints = totalPoints10;
    let simGradedCredits = gradedCredits;

    const remainingCourses = [...parsedData.inProgressCourses, ...parsedData.futureCourses];
    remainingCourses.forEach(c => {
      if (!shouldIncludeCourse(c)) return;
      const simVal = simulatedGrades[c.code];
      if (simVal !== undefined && simVal !== null && !isNaN(simVal)) {
        simTotalPoints += simVal * c.credits;
        simGradedCredits += c.credits;
      }
    });

    const simGpa10 = simGradedCredits > 0 ? (simTotalPoints / simGradedCredits) : gpa10;
    const simGpa4 = gradedCredits > 0 ? toScale4(simGpa10) : 0;

    return {
      gpa10: gpa10.toFixed(2),
      gpa4: gpa4.toFixed(2),
      classification,
      gradedCredits,
      totalPassedCredits,
      totalCurriculumCredits,
      semesterList,
      simGpa10: simGpa10.toFixed(2),
      simGpa4: (simGpa10 * 0.4).toFixed(2), // or toScale4(simGpa10)
      remainingCredits: remainingCourses.reduce((sum, c) => sum + (shouldIncludeCourse(c) ? c.credits : 0), 0)
    };
  }

  // Render HTML UI
  function renderDashboard() {
    let container = document.getElementById('fap-gpa-dashboard');
    if (!container) {
      container = document.createElement('div');
      container.id = 'fap-gpa-dashboard';

      // Insert above the main table card
      const tableCard = document.querySelector('.card.mb-3') || document.querySelector('.table-responsive') || document.querySelector('.content .container-fluid');
      if (tableCard && tableCard.parentNode) {
        tableCard.parentNode.insertBefore(container, tableCard);
      } else {
        document.body.prepend(container);
      }
    }

    const stats = calculateStats();

    // Render Content
    container.innerHTML = `
      <div class="fgpa-header" id="fgpa-toggle-collapse">
        <div class="fgpa-header-title">
          <span>🎓 Bảng Điểm GPA & Tín Chỉ Tích Lũy</span>
          <span class="fgpa-header-badge">FAP Tool</span>
        </div>
        <div class="fgpa-header-actions">
          <button type="button" class="fgpa-btn-icon" id="fgpa-btn-refresh" title="Tính lại điểm">
            <i class="ri-refresh-line">⟳</i>
          </button>
          <button type="button" class="fgpa-btn-icon" id="fgpa-btn-collapse" title="Thu gọn / Mở rộng">
            <span>${config.collapsed ? '▼' : '▲'}</span>
          </button>
        </div>
      </div>

      <div class="fgpa-body" style="display: ${config.collapsed ? 'none' : 'block'};">
        <!-- KPI Stat Cards -->
        <div class="fgpa-stats-grid">
          <div class="fgpa-stat-card primary">
            <div class="fgpa-stat-label">
              <span>GPA Tích Lũy (Hệ 10)</span>
              <span>🔟</span>
            </div>
            <div class="fgpa-stat-value">${stats.gpa10}</div>
            <div class="fgpa-stat-sub">Dựa trên ${stats.gradedCredits} tín chỉ tính điểm</div>
          </div>

          <div class="fgpa-stat-card success">
            <div class="fgpa-stat-label">
              <span>GPA Quy Đổi (Hệ 4)</span>
              <span>🎯</span>
            </div>
            <div class="fgpa-stat-value">${stats.gpa4}</div>
            <div class="fgpa-stat-sub">Thang điểm 4.0 chuẩn</div>
          </div>

          <div class="fgpa-stat-card info">
            <div class="fgpa-stat-label">
              <span>Tín Chỉ Tích Lũy</span>
              <span>📚</span>
            </div>
            <div class="fgpa-stat-value">${stats.totalPassedCredits} <span style="font-size: 1.1rem; font-weight: normal; color: var(--fgpa-text-muted);">/ ${stats.totalCurriculumCredits} TC</span></div>
            <div class="fgpa-stat-sub">${Math.round((stats.totalPassedCredits / (stats.totalCurriculumCredits || 1)) * 100)}% hoàn thành CTĐT</div>
          </div>

          <div class="fgpa-stat-card warning">
            <div class="fgpa-stat-label">
              <span>Xếp Loại Tốt Nghiệp</span>
              <span>${stats.classification.icon}</span>
            </div>
            <div class="fgpa-stat-value" style="font-size: 1.6rem;">${stats.classification.title}</div>
            <div class="fgpa-stat-sub">Xếp loại học lực hiện tại</div>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="fgpa-controls-bar">
          <div class="fgpa-checkbox-group">
            <label class="fgpa-checkbox-label" title="Theo quy chế FPT, môn Vovinam không tính vào GPA tốt nghiệp">
              <input type="checkbox" id="fgpa-opt-vov" ${config.excludeVOV ? 'checked' : ''}>
              <span>Bỏ qua Thể chất (VOV)</span>
            </label>
            <label class="fgpa-checkbox-label" title="Môn OJT (10 tín chỉ) có tính vào GPA">
              <input type="checkbox" id="fgpa-opt-ojt" ${config.includeOJT ? 'checked' : ''}>
              <span>Tính điểm môn OJT (10 TC)</span>
            </label>
            <label class="fgpa-checkbox-label" title="Các môn học ngoài khung chương trình đào tạo">
              <input type="checkbox" id="fgpa-opt-outside" ${config.includeOutside ? 'checked' : ''}>
              <span>Tính môn ngoài CTĐT</span>
            </label>
          </div>
          <div>
            <button type="button" class="fgpa-btn-action" id="fgpa-btn-copy-summary">
              📋 Sao chép tóm tắt GPA
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="fgpa-tabs">
          <button type="button" class="fgpa-tab-btn ${config.activeTab === 'semesters' ? 'active' : ''}" data-tab="semesters">
            📅 GPA Từng Học Kỳ
          </button>
          <button type="button" class="fgpa-tab-btn ${config.activeTab === 'simulator' ? 'active' : ''}" data-tab="simulator">
            🔮 Dự Đoán Điểm (GPA Simulator)
          </button>
          <button type="button" class="fgpa-tab-btn ${config.activeTab === 'courses' ? 'active' : ''}" data-tab="courses">
            📝 Danh Sách Môn Tính GPA
          </button>
        </div>

        <!-- Tab 1: Semesters Breakdown -->
        <div class="fgpa-tab-pane ${config.activeTab === 'semesters' ? 'active' : ''}" id="fgpa-pane-semesters">
          <div style="overflow-x: auto;">
            <table class="fgpa-table">
              <thead>
                <tr>
                  <th>Học Kỳ</th>
                  <th style="text-align: center;">Số Môn</th>
                  <th style="text-align: center;">Tín Chỉ Tính Điểm</th>
                  <th style="text-align: center;">GPA Học Kỳ (10)</th>
                  <th style="text-align: center;">GPA Học Kỳ (4)</th>
                  <th style="text-align: center;">GPA Tích Lũy Lũy Kế</th>
                </tr>
              </thead>
              <tbody>
                ${stats.semesterList.map(sem => `
                  <tr>
                    <td><strong>${sem.semester}</strong></td>
                    <td style="text-align: center;">${sem.courses.length}</td>
                    <td style="text-align: center;">${sem.gradedCredits} TC</td>
                    <td style="text-align: center;">
                      ${sem.semGpa10 !== null ? `<span class="fgpa-badge fgpa-badge-primary">${sem.semGpa10.toFixed(2)}</span>` : '<span style="color:#94a3b8;">-</span>'}
                    </td>
                    <td style="text-align: center;">
                      ${sem.semGpa4 !== null ? `<span class="fgpa-badge fgpa-badge-info">${sem.semGpa4.toFixed(2)}</span>` : '<span style="color:#94a3b8;">-</span>'}
                    </td>
                    <td style="text-align: center;">
                      ${sem.cumGpa10 !== null ? `<strong style="color: var(--fgpa-success);">${sem.cumGpa10.toFixed(2)}</strong>` : '<span style="color:#94a3b8;">-</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: GPA Simulator -->
        <div class="fgpa-tab-pane ${config.activeTab === 'simulator' ? 'active' : ''}" id="fgpa-pane-simulator">
          <div class="fgpa-simulator-header">
            <div>
              <strong>🎯 Điểm Dự Kiến Sau Khi Hoàn Thành Các Môn Còn Lại:</strong>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--fgpa-primary); margin-top: 4px;">
                GPA Dự Kiến: ${stats.simGpa10} / 10 (Hệ 4: ${stats.simGpa4})
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 0.85rem; color: var(--fgpa-text-muted);">Gán nhanh tất cả môn:</span>
              <button type="button" class="fgpa-btn-action fgpa-quick-fill" data-score="8.0" style="padding: 4px 10px; font-size: 0.8rem;">8.0 (Giỏi)</button>
              <button type="button" class="fgpa-btn-action fgpa-quick-fill" data-score="8.5" style="padding: 4px 10px; font-size: 0.8rem;">8.5</button>
              <button type="button" class="fgpa-btn-action fgpa-quick-fill" data-score="9.0" style="padding: 4px 10px; font-size: 0.8rem;">9.0 (Xuất sắc)</button>
              <button type="button" class="fgpa-btn-action fgpa-quick-reset" style="padding: 4px 10px; font-size: 0.8rem; background: #64748b;">Reset</button>
            </div>
          </div>

          <div style="font-size: 0.85rem; color: var(--fgpa-text-muted); margin-bottom: 12px;">
            Nhập điểm thử nghiệm (từ 0 đến 10) cho các môn đang học hoặc chuẩn bị học để dự đoán GPA tốt nghiệp:
          </div>

          <div class="fgpa-sim-inputs-grid">
            ${[...parsedData.inProgressCourses, ...parsedData.futureCourses].map(c => `
              <div class="fgpa-sim-card">
                <div class="fgpa-sim-info">
                  <span class="fgpa-sim-code">${c.code} <span style="font-size: 0.75rem; color: var(--fgpa-primary);">(${c.credits} TC)</span></span>
                  <span class="fgpa-sim-meta" title="${c.name}">${c.name.length > 28 ? c.name.slice(0, 28) + '...' : c.name}</span>
                  <span class="fgpa-sim-meta">Kỳ: ${c.term} | ${c.status}</span>
                </div>
                <div>
                  <input type="number" min="0" max="10" step="0.1" class="fgpa-sim-input" data-code="${c.code}" placeholder="-" value="${simulatedGrades[c.code] !== undefined ? simulatedGrades[c.code] : ''}">
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Tab 3: Detailed Courses -->
        <div class="fgpa-tab-pane ${config.activeTab === 'courses' ? 'active' : ''}" id="fgpa-pane-courses">
          <div style="font-size: 0.85rem; color: var(--fgpa-text-muted); margin-bottom: 12px;">
            Bỏ chọn môn nếu bạn muốn kiểm tra GPA khi không tính môn đó:
          </div>
          <div style="overflow-x: auto;">
            <table class="fgpa-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">Tính</th>
                  <th>Mã Môn</th>
                  <th>Tên Môn</th>
                  <th style="text-align: center;">Tín Chỉ</th>
                  <th style="text-align: center;">Điểm</th>
                  <th style="text-align: center;">Trạng Thái</th>
                  <th>Học Kỳ</th>
                </tr>
              </thead>
              <tbody>
                ${parsedData.curriculumCourses.concat(config.includeOutside ? parsedData.outsideCourses : []).map(c => {
                  const isChecked = shouldIncludeCourse(c);
                  return `
                    <tr style="${!isChecked ? 'opacity: 0.55; text-decoration: line-through;' : ''}">
                      <td style="text-align: center;">
                        <input type="checkbox" class="fgpa-course-toggle" data-code="${c.code}" ${isChecked ? 'checked' : ''} ${c.grade === null ? 'disabled' : ''}>
                      </td>
                      <td><strong>${c.code}</strong></td>
                      <td>${c.name}</td>
                      <td style="text-align: center;">${c.credits}</td>
                      <td style="text-align: center;"><strong>${c.grade !== null ? c.grade.toFixed(1) : '-'}</strong></td>
                      <td style="text-align: center;"><span class="fgpa-badge ${c.isPassed ? 'fgpa-badge-success' : (c.isInProgress ? 'fgpa-badge-info' : 'fgpa-badge-primary')}">${c.status}</span></td>
                      <td>${c.semester}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    renderFloatingPill(stats);
    bindEvents();
  }

  // Render bottom-right floating pill
  function renderFloatingPill(stats) {
    let pill = document.getElementById('fap-gpa-floating-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'fap-gpa-floating-pill';
      pill.title = 'Nhấp để cuộn tới Bảng điểm GPA';
      document.body.appendChild(pill);
      pill.addEventListener('click', () => {
        const dashboard = document.getElementById('fap-gpa-dashboard');
        if (dashboard) {
          dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    pill.innerHTML = `
      <span>🎓 GPA:</span>
      <span class="fgpa-pill-gpa">${stats.gpa10}</span>
      <span style="opacity: 0.85; font-size: 0.8rem;">(${stats.totalPassedCredits} TC)</span>
    `;
  }

  // Bind Event Listeners
  function bindEvents() {
    // Collapse toggle
    const btnCollapse = document.getElementById('fgpa-btn-collapse');
    const headerToggle = document.getElementById('fgpa-toggle-collapse');
    if (headerToggle) {
      headerToggle.onclick = (e) => {
        if (e.target.closest('#fgpa-btn-refresh')) return;
        config.collapsed = !config.collapsed;
        saveConfig();
        renderDashboard();
      };
    }

    // Refresh
    const btnRefresh = document.getElementById('fgpa-btn-refresh');
    if (btnRefresh) {
      btnRefresh.onclick = (e) => {
        e.stopPropagation();
        scrapeData();
        renderDashboard();
      };
    }

    // Checkboxes
    const optVov = document.getElementById('fgpa-opt-vov');
    if (optVov) {
      optVov.onchange = (e) => {
        config.excludeVOV = e.target.checked;
        saveConfig();
        renderDashboard();
      };
    }

    const optOjt = document.getElementById('fgpa-opt-ojt');
    if (optOjt) {
      optOjt.onchange = (e) => {
        config.includeOJT = e.target.checked;
        saveConfig();
        renderDashboard();
      };
    }

    const optOutside = document.getElementById('fgpa-opt-outside');
    if (optOutside) {
      optOutside.onchange = (e) => {
        config.includeOutside = e.target.checked;
        saveConfig();
        renderDashboard();
      };
    }

    // Copy summary button
    const btnCopy = document.getElementById('fgpa-btn-copy-summary');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const stats = calculateStats();
        const text = `=== BÁO CÁO GPA FPT UNIVERSITY ===\n` +
          `• GPA Tích lũy (Hệ 10): ${stats.gpa10}\n` +
          `• GPA Quy đổi (Hệ 4): ${stats.gpa4}\n` +
          `• Xếp loại học lực: ${stats.classification.title}\n` +
          `• Tín chỉ đã tích lũy: ${stats.totalPassedCredits} / ${stats.totalCurriculumCredits} TC\n` +
          `• Số tín chỉ tính điểm: ${stats.gradedCredits} TC\n` +
          `==================================`;
        navigator.clipboard.writeText(text).then(() => {
          btnCopy.textContent = '✅ Đã sao chép!';
          setTimeout(() => { btnCopy.textContent = '📋 Sao chép tóm tắt GPA'; }, 2000);
        });
      };
    }

    // Tabs
    const tabButtons = document.querySelectorAll('.fgpa-tab-btn');
    tabButtons.forEach(btn => {
      btn.onclick = () => {
        config.activeTab = btn.getAttribute('data-tab');
        saveConfig();
        renderDashboard();
      };
    });

    // Simulator inputs
    const simInputs = document.querySelectorAll('.fgpa-sim-input');
    simInputs.forEach(input => {
      input.oninput = (e) => {
        const code = e.target.getAttribute('data-code');
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0 && val <= 10) {
          simulatedGrades[code] = val;
        } else if (e.target.value === '') {
          delete simulatedGrades[code];
        }
        // Update live summary without full re-render to avoid losing input focus
        const stats = calculateStats();
        const headerEl = document.querySelector('.fgpa-simulator-header strong + div');
        if (headerEl) {
          headerEl.textContent = `GPA Dự Kiến: ${stats.simGpa10} / 10 (Hệ 4: ${stats.simGpa4})`;
        }
      };
    });

    // Quick fill simulator
    const quickFills = document.querySelectorAll('.fgpa-quick-fill');
    quickFills.forEach(btn => {
      btn.onclick = () => {
        const targetScore = parseFloat(btn.getAttribute('data-score'));
        [...parsedData.inProgressCourses, ...parsedData.futureCourses].forEach(c => {
          simulatedGrades[c.code] = targetScore;
        });
        renderDashboard();
      };
    });

    const quickReset = document.querySelector('.fgpa-quick-reset');
    if (quickReset) {
      quickReset.onclick = () => {
        simulatedGrades = {};
        renderDashboard();
      };
    }

    // Toggle individual courses
    const courseToggles = document.querySelectorAll('.fgpa-course-toggle');
    courseToggles.forEach(toggle => {
      toggle.onchange = (e) => {
        const code = e.target.getAttribute('data-code');
        if (e.target.checked) {
          config.customDisabledCodes = config.customDisabledCodes.filter(c => c !== code);
        } else {
          if (!config.customDisabledCodes.includes(code)) {
            config.customDisabledCodes.push(code);
          }
        }
        saveConfig();
        renderDashboard();
      };
    });
  }

  // Listener for messages from popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'GET_GPA_DATA') {
        const stats = calculateStats();
        sendResponse({
          success: true,
          stats,
          parsedData
        });
      } else if (request.action === 'SCROLL_TO_DASHBOARD') {
        const dashboard = document.getElementById('fap-gpa-dashboard');
        if (dashboard) {
          dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      return true;
    });
  }

  // Initialize
  function init() {
    loadConfig(() => {
      if (scrapeData()) {
        renderDashboard();
      } else {
        // Retry in case table renders dynamically
        setTimeout(() => {
          if (scrapeData()) {
            renderDashboard();
          }
        }, 800);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
