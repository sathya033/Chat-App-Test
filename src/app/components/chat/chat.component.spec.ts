import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { ChatComponent } from './chat.component';
import { ChatService } from '../../services/chat.service';
import { FormGroupName } from '@angular/forms';


describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let mockChatService: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    mockChatService = jasmine.createSpyObj('ChatService', [
      'initializeSocket',
      'disconnect',
      'getMessages',
      'scrollToBottom',
      'getTypingStatus',
      'getOnlineUsers',
      'getUsers',
      'getGroups',
      'markMessagesAsRead',
      'getGroupChatHistory',
      'sendPrivateMessage',
      'sendGroupMessage',
      'createGroup',
      'addUserToGroup',
      'getUnreadMessageCount',
      'getGroupUnreadCount',
      'emitTyping',
      'emitGroupTyping',
      'getGroupChatHistory',
      'getChatHistory',
      'markGroupMessagesAsRead',
    ]);

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ChatComponent],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;


    // Mock default return values
    mockChatService.getMessages.and.returnValue(of([]));
    mockChatService.getTypingStatus.and.returnValue(of({ isTyping: false, user: '' }));
    mockChatService.getOnlineUsers.and.returnValue(of([]));
    mockChatService.getUsers.and.returnValue(of([]));
    mockChatService.getGroups.and.returnValue(of([]));
    mockChatService.getUnreadMessageCount.and.returnValue(of({ unreadCount: 0 }));
    mockChatService.getGroupUnreadCount.and.returnValue(of({ unreadCount: 0 }));
    mockChatService.getChatHistory.and.returnValue(of([]));

    fixture.detectChanges();
  });

  it(' create', () => {
    expect(component).toBeTruthy();
  });



  it('toggle chat visibility and reset unread count when opened', () => {
    component.isOpen = false;
    component.totalUnreadCount = 5;

    component.toggleChat();

    expect(component.isOpen).toBeTrue();
    expect(component.totalUnreadCount).toBe(2);

    component.toggleChat();

    expect(component.isOpen).toBeFalse();
  });

  it('initialize socket on component init', () => {
    component.ngOnInit();

    expect(mockChatService.initializeSocket).toHaveBeenCalled();
  });

  it('disconnect socket on component destroy', () => {
    component.ngOnDestroy();

    expect(mockChatService.disconnect).toHaveBeenCalled();
  });

  it('messages on component init', () => {
    component.ngOnInit();

    expect(mockChatService.getMessages).toHaveBeenCalled();
  });

  it('fetch users on component init', () => {
    component.ngOnInit();

    expect(mockChatService.getUsers).toHaveBeenCalled();
  });

  it('toggle to users view', () => {
    component.viewMode = 'groups';
    component.toggleToUsers();
    expect(component.viewMode).toBe('users');
    expect(component.selectedGroup).toBeNull();
  });

  it('toggle to groups view', () => {
    component.viewMode = 'users';
    component.toggleToGroups();
    expect(component.viewMode).toBe('groups');
    expect(component.selectedUser).toBeNull();
  });

  it('send a private message', () => {
    component.selectedUser = 'testUser';
    component.message = 'Hello';
    mockChatService.sendPrivateMessage.and.callThrough();

    component.sendMessage();

    expect(mockChatService.sendPrivateMessage).toHaveBeenCalledWith('testUser', 'Hello');
    expect(component.message).toBe('');
  });

  it('get group', () => {
    component.ngOnInit();
    expect(mockChatService.getGroups).toHaveBeenCalled();
  });

  it(' fetch users on fetchUsers call', () => {
    mockChatService.getUsers.and.returnValue(of([{ username: 'user1' }, { username: 'user2' }]));
    component.fetchUsers();
    expect(mockChatService.getUsers).toHaveBeenCalled();
    expect(component.users.length).toBe(2);
  });

  it(' fetch groups on fetchGroups call', () => {
    mockChatService.getGroups.and.returnValue(of([{ name: 'group1', members: [] }]));
    component.fetchGroups();
    expect(mockChatService.getGroups).toHaveBeenCalled();
    expect(component.groups.length).toBe(1);
  });

  it(' toggle to users view', () => {
    component.viewMode = 'groups';
    component.toggleToUsers();
    expect(component.viewMode).toBe('users');
    expect(component.selectedGroup).toBeNull();
  });

  it(' toggle to groups view', () => {
    component.viewMode = 'users';
    component.toggleToGroups();
    expect(component.viewMode).toBe('groups');
    expect(component.selectedUser).toBeNull();
  });


  it(' send a private message', () => {
    component.selectedUser = 'testUser';
    component.message = 'Hello';
    component.sendMessage();
    expect(mockChatService.sendPrivateMessage).toHaveBeenCalledWith('testUser', 'Hello');
    expect(component.message).toBe('');
  });

  it('send a group message', () => {
    component.selectedGroup = { name: 'testGroup', members: [] };
    component.message = 'Hello Group';
    component.sendMessage();
    expect(mockChatService.sendGroupMessage).toHaveBeenCalledWith('testGroup', 'Hello Group');
    expect(component.message).toBe('');
  });

  it('create group', () => {
    component.newGroupName = 'NewGroup';
    mockChatService.createGroup.and.returnValue(of({}));
    component.createGroup();
    expect(mockChatService.createGroup).toHaveBeenCalledWith({
      groupName: 'NewGroup',
      admin: component.currentUser,
    });
    expect(component.newGroupName).toBe('');
  });

  it('add a user to a group', () => {
    const group = { name: 'testGroup', members: [] };
    mockChatService.addUserToGroup.and.returnValue(of({}));
    component.addUser(group, 'newUser');
    expect(mockChatService.addUserToGroup).toHaveBeenCalledWith({
      groupName: 'testGroup',
      username: 'newUser',
    });
  });

  it('toggle chat visibility and reset unread count when opened', () => {
    component.isOpen = false;
    component.totalUnreadCount = 5;
    component.toggleChat();
    expect(component.isOpen).toBeTrue();
    expect(component.totalUnreadCount).toBe(0);
    component.toggleChat();
    expect(component.isOpen).toBeFalse();
  });

  it(' emit typing status for private chat', () => {
    component.selectedUser = 'testUser';
    component.onTyping();
    expect(mockChatService.emitTyping).toHaveBeenCalledWith('testUser', true);
  });

  it(' emit typing status for group chat', () => {
    component.selectedGroup = { name: 'testGroup', members: [] };
    component.onTypingGroup();
    expect(mockChatService.emitGroupTyping).toHaveBeenCalledWith('testGroup', true);
  });

  it('fetch users and initialize unread counts', () => {
    const mockUsers = [{ username: 'user1' }, { username: 'user2' }];
    mockChatService.getUsers.and.returnValue(of(mockUsers));
    mockChatService.getUnreadMessageCount.and.returnValue(of({ unreadCount: 2 }));

    component.fetchUsers();

    expect(mockChatService.getUsers).toHaveBeenCalled();
    expect(component.users.length).toBe(2);
    expect(component.users[0].unreadCount).toBe(2);
  });

  it('fetch groups and initialize unread counts', () => {
    const mockGroups = [{ name: 'group1', members: [] }];
    mockChatService.getGroups.and.returnValue(of(mockGroups));
    mockChatService.getGroupUnreadCount.and.returnValue(of({ unreadCount: 3 }));

    component.fetchGroups();

    expect(mockChatService.getGroups).toHaveBeenCalled();
    expect(component.groups.length).toBe(1);
    expect(component.groups[0].unreadCount).toBe(3);
  });

  it(' select a user and fetch chat history', () => {
    const mockMessages = [
      { sender: 'user1', receiver: 'currentUser', message: 'Hello', timestamp: new Date() },
    ];
    mockChatService.getChatHistory.and.returnValue(of(mockMessages));
    mockChatService.markMessagesAsRead.and.returnValue(of({}));

    component.currentUser = 'currentUser';
    component.selectUser('user1');

    expect(component.selectedUser).toBe('user1');
    expect(mockChatService.markMessagesAsRead).toHaveBeenCalledWith('currentUser', 'user1');
    expect(mockChatService.getChatHistory).toHaveBeenCalledWith('currentUser', 'user1');
    expect(component.messages.length).toBe(1);
  });


  it('toggle add group user visibility', () => {
    component.users = [{ username: 'user1' }, { username: 'user2' }];
    component.selectedGroup = { name: 'group1', members: ['user1'] };

    component.toggleAddGroupUser();

    expect(component.showAddGroupUser).toBeTrue();
    expect(component.filteredUsers.length).toBe(1);
    expect(component.filteredUsers[0].username).toBe('user2');
  });

  it('emit typing status for private chat', () => {
    component.selectedUser = 'user1';
    component.onTyping();

    expect(mockChatService.emitTyping).toHaveBeenCalledWith('user1', true);
  });

  it(' emit typing status for group chat', () => {
    component.selectedGroup = { name: 'group1', members: [] };
    component.onTypingGroup();

    expect(mockChatService.emitGroupTyping).toHaveBeenCalledWith('group1', true);
  });


  it('handle empty message on sendMessage', () => {
    component.message = '   ';
    component.sendMessage();

    expect(mockChatService.sendPrivateMessage).not.toHaveBeenCalled();
    expect(mockChatService.sendGroupMessage).not.toHaveBeenCalled();
  });

  it('handle empty group name on createGroup', () => {
    component.newGroupName = '   ';
    component.createGroup();

    expect(mockChatService.createGroup).not.toHaveBeenCalled();
  });

  it('handle null selected user on sendMessage', () => {
    component.selectedUser = null;
    component.message = 'Hello';
    component.sendMessage();

    expect(mockChatService.sendPrivateMessage).not.toHaveBeenCalled();
  });

  it('handle empty group name when creating a group', () => {
    component.newGroupName = '   ';
    component.createGroup();

    expect(mockChatService.createGroup).not.toHaveBeenCalled();
  });


  it('handle null selected user when sending a private message', () => {
    component.selectedUser = null;
    component.message = 'Hello';
    component.sendMessage();

    expect(mockChatService.sendPrivateMessage).not.toHaveBeenCalled();
  });

  it('handle null selected group when sending a group message', () => {
    component.selectedGroup = null;
    component.message = 'Hello Group';
    component.sendMessage();

    expect(mockChatService.sendGroupMessage).not.toHaveBeenCalled();
  });

  it('handle null selected user when emitting typing status', () => {
    component.selectedUser = null;
    component.onTyping();

    expect(mockChatService.emitTyping).not.toHaveBeenCalled();
  });

  it(' handle null selected group when emitting group typing status', () => {
    component.selectedGroup = null;
    component.onTypingGroup();

    expect(mockChatService.emitGroupTyping).not.toHaveBeenCalled();
  });

});
