/**
 * Tests for parser types module
 *
 * Testing detectLanguage function
 * This was flagged as a HIGH POSIWID finding
 */

import { describe, test, expect } from 'bun:test'
import { detectLanguage, type Language } from './types'

describe('detectLanguage', () => {
  describe('TypeScript files', () => {
    test('detects .ts files', () => {
      expect(detectLanguage('file.ts')).toBe('typescript')
    })

    test('detects .tsx files', () => {
      expect(detectLanguage('component.tsx')).toBe('typescript')
    })

    test('handles full paths', () => {
      expect(detectLanguage('src/components/Button.tsx')).toBe('typescript')
    })
  })

  describe('JavaScript files', () => {
    test('detects .js files', () => {
      expect(detectLanguage('file.js')).toBe('javascript')
    })

    test('detects .jsx files', () => {
      expect(detectLanguage('component.jsx')).toBe('javascript')
    })

    test('detects .mjs files', () => {
      expect(detectLanguage('module.mjs')).toBe('javascript')
    })

    test('detects .cjs files', () => {
      expect(detectLanguage('commonjs.cjs')).toBe('javascript')
    })
  })

  describe('Python files', () => {
    test('detects .py files', () => {
      expect(detectLanguage('script.py')).toBe('python')
    })

    test('detects .pyw files', () => {
      expect(detectLanguage('gui_app.pyw')).toBe('python')
    })
  })

  describe('Go files', () => {
    test('detects .go files', () => {
      expect(detectLanguage('main.go')).toBe('go')
    })
  })

  describe('Rust files', () => {
    test('detects .rs files', () => {
      expect(detectLanguage('lib.rs')).toBe('rust')
    })
  })

  describe('Java files', () => {
    test('detects .java files', () => {
      expect(detectLanguage('Main.java')).toBe('java')
    })
  })

  describe('C/C++ files', () => {
    test('detects .c files', () => {
      expect(detectLanguage('main.c')).toBe('c')
    })

    test('detects .h header files', () => {
      expect(detectLanguage('header.h')).toBe('c')
    })

    test('detects .cpp files', () => {
      expect(detectLanguage('main.cpp')).toBe('cpp')
    })

    test('detects .cc files', () => {
      expect(detectLanguage('main.cc')).toBe('cpp')
    })

    test('detects .cxx files', () => {
      expect(detectLanguage('main.cxx')).toBe('cpp')
    })

    test('detects .hpp files', () => {
      expect(detectLanguage('header.hpp')).toBe('cpp')
    })
  })

  describe('C# files', () => {
    test('detects .cs files', () => {
      expect(detectLanguage('Program.cs')).toBe('csharp')
    })
  })

  describe('Ruby files', () => {
    test('detects .rb files', () => {
      expect(detectLanguage('script.rb')).toBe('ruby')
    })
  })

  describe('PHP files', () => {
    test('detects .php files', () => {
      expect(detectLanguage('index.php')).toBe('php')
    })
  })

  describe('Swift files', () => {
    test('detects .swift files', () => {
      expect(detectLanguage('App.swift')).toBe('swift')
    })
  })

  describe('Kotlin files', () => {
    test('detects .kt files', () => {
      expect(detectLanguage('Main.kt')).toBe('kotlin')
    })

    test('detects .kts script files', () => {
      expect(detectLanguage('build.gradle.kts')).toBe('kotlin')
    })
  })

  describe('edge cases', () => {
    test('returns unknown for unrecognized extension', () => {
      expect(detectLanguage('file.xyz')).toBe('unknown')
    })

    test('returns unknown for no extension', () => {
      expect(detectLanguage('Makefile')).toBe('unknown')
    })

    test('handles uppercase extensions', () => {
      expect(detectLanguage('file.TS')).toBe('typescript')
    })

    test('handles mixed case extensions', () => {
      expect(detectLanguage('file.Py')).toBe('python')
    })

    test('handles multiple dots in filename', () => {
      expect(detectLanguage('file.test.spec.ts')).toBe('typescript')
    })

    test('handles paths with dots', () => {
      expect(detectLanguage('./src/module.v2/file.ts')).toBe('typescript')
    })

    test('handles empty string', () => {
      expect(detectLanguage('')).toBe('unknown')
    })

    test('handles dot-only filename', () => {
      expect(detectLanguage('.gitignore')).toBe('unknown')
    })
  })
})
