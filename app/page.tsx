'use client';

import Link from 'next/link';
import { 
  HelpCircle, 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  CheckCircle, 
  ArrowRight, 
  Users, 
  Clock, 
  Calculator, 
  ListChecks, 
  CalendarOff,
  Info
} from 'lucide-react';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-6">
            <HelpCircle className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">
            FRAGE Lesson Plan Generator Guide
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed whitespace-pre-line break-keep">
            FRAGE Lesson Plan Generator는 실제 수업 환경을 최대한 정확하게 반영하여,
            각 반(Class)의 수업 흐름과 교재 진행을 체계적으로 관리하기 위해 설계된 자동화 시스템입니다.
            
          </p>
          
          <div className="mt-8">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <LayoutDashboard className="w-5 h-5" />
              Go to Generator
            </Link>
          </div>
        </div>

        <div className="space-y-12">
          
          {/* Section 1 */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl shrink-0">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Class란 무엇인가요?</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    FRAGE에서 Class는 단순한 학생 그룹이 아니라, <strong>실제 수업이 이루어지는 운영 단위</strong>를 의미합니다.
                  </p>
                  <p>
                    각 Class는 고유한 수업 요일(예: 화·수·금), 시작 시점, 그리고 커리큘럼 흐름을 가집니다.
                    모든 레슨 플랜은 교재(Book) 기준이 아니라, Class 기준으로 생성되고 관리됩니다.
                  </p>
                  <p>
                    중요한 점은, Class마다 학기 시작 시점이 다를 수 있다는 것입니다.
                    어떤 반은 3월에 시작할 수 있고, 어떤 반은 4월이나 6월에 시작할 수도 있습니다.
                  </p>
                  <p>
                    FRAGE 시스템은 이 차이를 반영하기 위해, 절대적인 달력 월이 아닌 상대적인 학습 단계 개념을 사용합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-50 rounded-xl shrink-0">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Month 1–6 (Relative Month System)</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    FRAGE의 모든 커리큘럼은 Month 1부터 시작하는 상대적 월 체계를 사용합니다.
                    여기서 Month 1은 "3월"이나 "9월" 같은 고정된 달을 의미하지 않습니다.
                  </p>
                  <p>
                    대신, 해당 Class가 처음 수업을 시작하는 달이 자동으로 Month 1이 됩니다.
                    이후 Month 2, Month 3는 순차적으로 이어집니다.
                  </p>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-purple-900 text-sm">
                    <strong>Why?</strong> 이 구조 덕분에 학기 시작 시점이 달라도, 모든 반은 동일한 6개월 학습 구조 안에서 관리될 수 있습니다.
                  </div>
                  <p>
                    이 상대적 Month 체계는 커리큘럼 단계 관리와 진도 추적을 위한 개념이며,
                    실제 수업일 계산에는 달력(Calendar Month)이 함께 사용됩니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-xl shrink-0">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Calendar Month는 왜 필요한가요?</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    Month 1–6은 학습 단계 개념이지만,
                    실제 수업 가능 횟수 계산은 반드시 달력 기준으로 이루어져야 합니다.
                  </p>
                  <p>
                    Plan Generator는 다음 요소들을 고려하여 월별 수업 횟수를 계산합니다:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Class의 수업 요일</li>
                    <li>공휴일(Holidays)</li>
                    <li>행사일 및 특수 일정(Special Dates)</li>
                    <li>해당 월의 실제 날짜 구조</li>
                  </ul>
                  <p>
                    예를 들어, Month 1이 되는 달에 공휴일이 많다면 그 달의 실제 수업 횟수는 자연스럽게 줄어들게 됩니다.
                  </p>
                  <div className="flex flex-col md:flex-row gap-4 mt-4">
                    <div className="flex-1 bg-slate-50 p-4 rounded-xl text-center border border-slate-200">
                      <span className="block font-bold text-slate-800 mb-1">Calendar Month</span>
                      <span className="text-sm text-slate-500">계산용</span>
                    </div>
                    <div className="flex-1 bg-slate-50 p-4 rounded-xl text-center border border-slate-200">
                      <span className="block font-bold text-slate-800 mb-1">Month 1–6</span>
                      <span className="text-sm text-slate-500">커리큘럼 단계용</span>
                    </div>
                  </div>
                  <p className="mt-4">
                    이 두 개념은 서로 대체 관계가 아니라, 반드시 함께 사용되는 구조입니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-50 rounded-xl shrink-0">
                <BookOpen className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Book은 어떻게 계산되나요?</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    FRAGE에서 각 교재(Book)는 고정된 학습 구조를 가지고 있습니다.
                    일반적으로 교재는 다음과 같은 요소로 구성됩니다:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>총 Unit 수</li>
                    <li>Unit당 수업 일수 (Days per Unit)</li>
                  </ul>
                  <p>
                    시스템은 이 정보를 바탕으로 <strong>한 권의 교재를 완료하는 데 필요한 총 수업 횟수(Total Sessions)</strong>를 자동으로 계산합니다.
                  </p>
                  <p>
                    이 계산 덕분에, 교재가 중간에 끝나거나 학기 종료 전에 남는 일이 없도록 수업 분량을 안정적으로 분배할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-50 rounded-xl shrink-0">
                <ListChecks className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Assigned Courses란 무엇인가요?</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    Assigned Courses는 FRAGE 수업 플래닝의 중심 화면입니다.
                    여기에서는 각 Class에 대해 다음 항목들을 한눈에 관리할 수 있습니다:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>어떤 교재를 사용할지</li>
                    <li>Month 1부터 Month 6까지 각 Month에 몇 회의 수업을 배정할지</li>
                    <li>현재까지 진행된 수업과 남은 수업은 얼마나 되는지</li>
                  </ul>
                  <p className="font-medium text-slate-800">
                    실제 운영에서는 대부분의 커리큘럼 조정과 관리가 <span className="text-indigo-600">Classes → Assigned Courses</span> 화면에서 이루어집니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Plan Generator + Steps */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 ring-1 ring-indigo-50">
            <div className="flex items-start gap-4 mb-8">
              <div className="p-3 bg-indigo-50 rounded-xl shrink-0">
                <Calculator className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Plan Generator</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    Plan Generator는 실제 수업 운영을 위한 메인 관리 화면이 아니라,
                    <strong>계산과 시뮬레이션을 위한 내부 도구</strong>입니다.
                  </p>
                  <p>
                    Plan Generator는 다음과 같은 역할을 합니다:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mb-6">
                    <li>달력 기반으로 월별 수업 가능 횟수 계산</li>
                    <li>공휴일 및 특수 일정 자동 반영</li>
                    <li>예상 커리큘럼 흐름 시뮬레이션</li>
                    <li>플랜 결과를 데이터베이스에 저장하거나 PDF로 출력</li>
                  </ul>
                  <div className="bg-indigo-50 p-4 rounded-xl text-center font-medium text-indigo-900 mb-8">
                    Plan Generator = 계산기 <span className="mx-2 text-indigo-300">|</span> Assigned Courses = 실제 운영 관리 화면
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Steps Grid (Moved from original page) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="text-6xl font-black text-indigo-900">1</span>
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-4 shadow-sm">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Class Configuration</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    Class Name과 수업 요일을 선택하면 시스템이 공휴일을 제외한 실제 수업일을 계산합니다.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="text-6xl font-black text-indigo-900">2</span>
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-4 shadow-sm">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Book Allocation</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    각 월에 교재를 배정하면, 시스템이 진행률을 추적하여 책이 제때 끝나는지 확인합니다.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="text-6xl font-black text-indigo-900">3</span>
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-4 shadow-sm">
                    <ArrowRight className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Generate & Save</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    Generate All을 클릭하여 전체 커리큘럼을 생성하고, DB에 저장하거나 PDF로 출력합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 rounded-xl shrink-0">
                <CalendarOff className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">7. 공휴일과 특수 일정은 어떻게 처리되나요?</h2>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                  <p>
                    모든 공휴일과 특수 일정은 시스템 데이터베이스에 저장되어 있으며,
                    Plan Generator와 Assigned Courses에서 자동으로 반영됩니다.
                  </p>
                  <p>
                    수업이 공휴일과 겹칠 경우, 해당 날짜는 자동으로 제외되고 수업은 다음 가능한 날짜로 이동합니다.
                    이를 통해 수업 누락 없이 안정적인 학습 흐름을 유지할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Outro */}
          <div className="bg-slate-900 text-slate-300 p-8 md:p-12 rounded-3xl text-center">
            <h2 className="text-2xl font-bold text-white mb-6">마무리하며</h2>
            <p className="max-w-2xl mx-auto leading-relaxed mb-8">
              FRAGE Lesson Plan System은 <strong>“달력 중심 수업 관리”</strong>와 <strong>“커리큘럼 중심 학습 설계”</strong>를 동시에 만족시키기 위해 설계되었습니다.
              Calendar Month로 정확하게 계산하고, Relative Month(Month 1–6)로 학습 단계를 관리하며, Class 기준으로 모든 수업을 통합 운영합니다.
            </p>
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
              Start Planning Now
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
