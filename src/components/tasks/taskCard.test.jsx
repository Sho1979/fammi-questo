/**
 * Tests for TaskCard.jsx
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import TaskCard from './TaskCard.jsx'

const members = [
  { id: 'm1', name: 'Papà', role: 'parent', icon: '👨', color: '#4A90D9' },
  { id: 'm2', name: 'Luca', role: 'child', icon: '👦', color: '#FF9800' },
]

const baseTask = {
  id: 't1',
  title: 'Fare i compiti',
  category: 'studio',
  assigned_to: 'm2',
  status: 'todo',
  priority: 'medium',
  accepted: true,
  points: 0,
}

describe('TaskCard', () => {
  it('renders task title and assignee', () => {
    const { container } = render(
      <TaskCard task={baseTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).toContain('Fare i compiti')
    expect(container.textContent).toContain('Luca')
  })

  it('renders category icon', () => {
    const { container } = render(
      <TaskCard task={baseTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).toContain('📚')
  })

  it('shows done state with line-through', () => {
    const doneTask = { ...baseTask, status: 'done' }
    const { container } = render(
      <TaskCard task={doneTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    const title = container.querySelector('.line-through')
    expect(title).toBeTruthy()
  })

  it('calls onToggle when toggle button is clicked', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <TaskCard task={baseTask} members={members} onToggle={onToggle} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    const toggleBtn = container.querySelector('button')
    fireEvent.click(toggleBtn)
    expect(onToggle).toHaveBeenCalledWith('t1')
  })

  it('shows edit and delete buttons for accepted non-done tasks', () => {
    const { container } = render(
      <TaskCard task={baseTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    const editBtn = container.querySelector('[aria-label="Modifica"]')
    const deleteBtn = container.querySelector('[aria-label="Elimina"]')
    expect(editBtn).toBeTruthy()
    expect(deleteBtn).toBeTruthy()
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    const { container } = render(
      <TaskCard task={baseTask} members={members} onToggle={() => {}} onEdit={onEdit} onDelete={() => {}} isParent />
    )
    const editBtn = container.querySelector('[aria-label="Modifica"]')
    fireEvent.click(editBtn)
    expect(onEdit).toHaveBeenCalledWith(baseTask)
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    const { container } = render(
      <TaskCard task={baseTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={onDelete} isParent />
    )
    const deleteBtn = container.querySelector('[aria-label="Elimina"]')
    fireEvent.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledWith('t1')
  })

  it('shows accept/reassign/reject for new unaccepted tasks', () => {
    const newTask = { ...baseTask, accepted: false, status: 'todo' }
    const { container } = render(
      <TaskCard task={newTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).toContain('Accetta')
    expect(container.textContent).toContain('Assegna')
    expect(container.textContent).toContain('Rifiuta')
  })

  it('calls onAccept when Accetta is clicked', () => {
    const onAccept = vi.fn()
    const newTask = { ...baseTask, accepted: false, status: 'todo' }
    const { container } = render(
      <TaskCard task={newTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} onAccept={onAccept} isParent />
    )
    const acceptBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Accetta'))
    fireEvent.click(acceptBtn)
    expect(onAccept).toHaveBeenCalledWith('t1')
  })

  it('shows points for child tasks with points > 0', () => {
    const pointTask = { ...baseTask, points: 10 }
    const { container } = render(
      <TaskCard task={pointTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).toContain('10')
    expect(container.textContent).toContain('pt')
  })

  it('shows "Tutti" when assigned_to is "tutti"', () => {
    const tuttiTask = { ...baseTask, assigned_to: 'tutti' }
    const { container } = render(
      <TaskCard task={tuttiTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).toContain('Tutti')
  })

  it('shows description when present and task is not done', () => {
    const descTask = { ...baseTask, description: 'Matematica e scienze' }
    const { container } = render(
      <TaskCard task={descTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).toContain('Matematica e scienze')
  })

  it('hides description when task is done', () => {
    const descTask = { ...baseTask, description: 'Dettaglio', status: 'done' }
    const { container } = render(
      <TaskCard task={descTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.textContent).not.toContain('Dettaglio')
  })

  it('shows reassign member picker when Assegna clicked', () => {
    const newTask = { ...baseTask, accepted: false, status: 'todo' }
    const { container } = render(
      <TaskCard task={newTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} onAccept={() => {}} onReassign={() => {}} isParent />
    )
    const assignBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Assegna'))
    fireEvent.click(assignBtn)
    expect(container.textContent).toContain('Assegna a:')
    expect(container.textContent).toContain('Papà')
  })

  it('calls onReassign when member is picked', () => {
    const onReassign = vi.fn()
    const newTask = { ...baseTask, accepted: false, status: 'todo' }
    const { container } = render(
      <TaskCard task={newTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} onAccept={() => {}} onReassign={onReassign} isParent />
    )
    const assignBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Assegna'))
    fireEvent.click(assignBtn)
    const papBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Papà'))
    fireEvent.click(papBtn)
    expect(onReassign).toHaveBeenCalledWith('t1', 'm1')
  })

  it('shows reminder style for needsConfirm tasks', () => {
    const reminderTask = { ...baseTask, accepted: false, status: 'todo', needsConfirm: true, fromPerson: 'Papà' }
    const { container } = render(
      <TaskCard task={reminderTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} onAccept={() => {}} isParent />
    )
    expect(container.textContent).toContain('Letto ✓')
    expect(container.textContent).toContain('Papà')
  })

  it('shows reopen button for done tasks when isParent', () => {
    const doneTask = { ...baseTask, status: 'done' }
    const { container } = render(
      <TaskCard task={doneTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.querySelector('[aria-label="Riapri"]')).toBeTruthy()
  })

  it('hides edit/delete for done tasks', () => {
    const doneTask = { ...baseTask, status: 'done' }
    const { container } = render(
      <TaskCard task={doneTask} members={members} onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isParent />
    )
    expect(container.querySelector('[aria-label="Modifica"]')).toBeFalsy()
    expect(container.querySelector('[aria-label="Elimina"]')).toBeFalsy()
  })
})
