import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

// Add interface for Message type at the top of the file
interface ChatMessage {
  sender: string;
  receiver?: string;
  group?: string;
  message: string;
  timestamp: string | Date;
  isRead?: boolean;
  readBy?: string[]; // Add readBy for group messages
}

interface Group {
  name: string;
  members: string[];
  unreadCount?: number;
  admin?: string;
}

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatBody') chatBody!: ElementRef;
  @ViewChild('groupChatBody') groupChatBody!: ElementRef;

  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;
  users: { username: string; unreadCount?: number }[] = [];
  groups: Group[] = [];
  messages: ChatMessage[] = [];
  viewMode: 'users' | 'groups' = 'users';
  currentUser: string = '';
  isOpen = false;
  totalUnreadCount = 0;
  typing = false;
  typingUser = '';
  showAddGroupUser = false;
  filteredUsers: any[] = [];
  groupMembers: string[] = [];
  onlineUsers: string[] = [];

  selectedUser: string | null = null;
  selectedGroup: any;
  message = '';
  newGroupName = '';
  admin = '';

  constructor(private http: HttpClient, private chatService: ChatService) {}

  ngOnInit(): void {
    this.currentUser = localStorage.getItem('currentUser') || '';
    console.log('Logged-in user:', this.currentUser);

    // Check if notifications are supported and request permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }

    // Initialize socket connection
    this.chatService.initializeSocket(this.currentUser);

    this.fetchUsers();
    this.fetchGroups();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    // Cleanup subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.chatService.disconnect();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private updateTotalUnreadCount(): void {
    const userUnreadCount = this.users.reduce((total, user) => total + (user.unreadCount || 0), 0);
    const groupUnreadCount = this.groups.reduce((total, group) => total + (group.unreadCount || 0), 0);
    this.totalUnreadCount = userUnreadCount + groupUnreadCount;
  }

  private setupSubscriptions(): void {
    // Subscribe to messages
    this.subscriptions.push(
      this.chatService.getMessages().subscribe(messages => {
        if (messages && messages.length > 0) {
          // Filter messages based on selected user or group
          const filteredMessages = messages.filter((msg: ChatMessage) => {
            if (this.selectedUser) {
              return (msg.sender === this.currentUser && msg.receiver === this.selectedUser) ||
                     (msg.sender === this.selectedUser && msg.receiver === this.currentUser);
            } else if (this.selectedGroup?.name) {
              return msg.group === this.selectedGroup.name;
            }
            return false;
          });

          // Remove duplicates and sort messages
          const uniqueMessages = this.removeDuplicateMessages(filteredMessages);
          this.messages = this.sortMessagesByTimestamp(uniqueMessages);
          this.shouldScrollToBottom = true;
          setTimeout(() => this.scrollToBottom(), 100);

          // Update unread counts
          this.updateUnreadCounts(messages);
        }
      })
    );

    // Subscribe to typing status
    this.subscriptions.push(
      this.chatService.getTypingStatus().subscribe(status => {
        this.typing = status.isTyping;
        this.typingUser = status.user;
      })
    );

    // Subscribe to online users
    this.subscriptions.push(
      this.chatService.getOnlineUsers().subscribe(users => {
        this.onlineUsers = users;
      })
    );
  }

  private removeDuplicateMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.reduce((acc: ChatMessage[], curr: ChatMessage) => {
      const isDuplicate = acc.some(msg =>
        msg.sender === curr.sender &&
        msg.message === curr.message &&
        (curr.receiver ? msg.receiver === curr.receiver : true) &&
        (curr.group ? msg.group === curr.group : true) &&
        new Date(msg.timestamp).getTime() === new Date(curr.timestamp).getTime()
      );
      if (!isDuplicate) {
        acc.push(curr);
      }
      return acc;
    }, []);
  }

  private sortMessagesByTimestamp(messages: ChatMessage[]): ChatMessage[] {
    return messages.sort((a: ChatMessage, b: ChatMessage) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  fetchUsers() {
    this.chatService.getUsers().subscribe(
      (users) => {
        this.users = users.filter(user => user.username.trim() !== this.currentUser.trim());
        // Initialize unread counts to 0
        this.users.forEach(user => {
          user.unreadCount = 0;
          // Get unread count for each user
          this.chatService.getUnreadMessageCount(this.currentUser).subscribe(
            (response) => {
              if (response && typeof response.unreadCount === 'number') {
                user.unreadCount = response.unreadCount;
                this.updateTotalUnreadCount();
              }
            },
            (error) => console.error('Error fetching unread count:', error)
          );
        });
      },
      (error) => console.error('Error fetching users:', error)
    );
  }

  fetchGroups() {
    console.log('Fetching groups for user:', this.currentUser);
    this.chatService.getGroups(this.currentUser).subscribe(
      (groups) => {
        console.log('Received groups:', groups);
        this.groups = groups;

        // Initialize unread counts to 0 and then get actual count
        this.groups.forEach(group => {
          group.unreadCount = 0;
          this.chatService.getGroupUnreadCount(group.name, this.currentUser).subscribe(
            (response) => {
              if (response && typeof response.unreadCount === 'number') {
                // Only update unread count if not currently viewing this group
                if (!this.selectedGroup || group.name !== this.selectedGroup.name) {
                  group.unreadCount = response.unreadCount;
                  this.updateTotalUnreadCount();
                }
              }
            },
            (error) => console.error('Error fetching group unread count:', error)
          );
        });
      },
      (error) => {
        console.error('Error fetching groups:', error);
        this.groups = [];
      }
    );
  }

  toggleToUsers() {
    this.viewMode = 'users';
    this.selectedGroup = null;
  }

  toggleToGroups() {
    this.viewMode = 'groups';
    this.selectedUser = null;
  }

  selectUser(username: string) {
    this.selectedUser = username;
    this.selectedGroup = null;
    this.messages = [];

    // Mark messages as read when selecting a user
    this.chatService.markMessagesAsRead(this.currentUser, username).subscribe(
      () => {
        // Update unread count for this user
        const user = this.users.find(u => u.username === username);
        if (user) {
          user.unreadCount = 0;
          this.updateTotalUnreadCount();
        }
      },
      (error) => console.error('Error marking messages as read:', error)
    );

    // Fetch chat history
    this.chatService.getChatHistory(this.currentUser, username).subscribe(
      (history) => {
        this.messages = history.filter((msg: ChatMessage) =>
          (msg.sender === this.currentUser && msg.receiver === username) ||
          (msg.sender === username && msg.receiver === this.currentUser)
        );
        this.shouldScrollToBottom = true;
      },
      (error) => console.error('Error fetching private chat history:', error)
    );
  }

  selectGroup(group: Group) {
    this.selectedGroup = group;
    this.selectedUser = null;
    this.messages = [];
    this.showAddGroupUser = false;

    // Mark messages as read when selecting a group
    this.chatService.markGroupMessagesAsRead(group.name, this.currentUser).subscribe(
      () => {
        const selectedGroup = this.groups.find(g => g.name === group.name);
        if (selectedGroup) {
          selectedGroup.unreadCount = 0;
          this.updateTotalUnreadCount();
        }
      },
      (error) => console.error('Error marking group messages as read:', error)
    );

    // Join the group socket room
    this.chatService.joinGroup(group.name);

    // Fetch group chat history
    this.chatService.getGroupChatHistory(group.name).subscribe(
      (history) => {
        // Filter messages for this group and sort by timestamp
        this.messages = this.sortMessagesByTimestamp(
          history.filter((msg: ChatMessage) => msg.group === group.name)
        );
        this.shouldScrollToBottom = true;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      (error) => {
        console.error('Error fetching group chat history:', error);
      }
    );
  }

  sendMessage() {
    if (!this.message.trim()) return;

    if (this.selectedUser) {
      this.chatService.sendPrivateMessage(this.selectedUser, this.message);
    } else if (this.selectedGroup) {
      this.chatService.sendGroupMessage(this.selectedGroup.name, this.message);
    }

    this.message = '';
    this.shouldScrollToBottom = true;
  }

  onTyping() {
    if (this.selectedUser) {
      this.chatService.emitTyping(this.selectedUser, true);

      setTimeout(() => {
        if (this.selectedUser) {
          this.chatService.emitTyping(this.selectedUser, false);
        }
      }, 700);
    }
  }

  createGroup() {
    if (!this.newGroupName.trim()) {
      return;
    }

    console.log('Creating new group:', this.newGroupName);
    const groupData = {
      groupName: this.newGroupName.trim(),
      admin: this.currentUser,
    };

    this.chatService.createGroup(groupData).subscribe(
      (response) => {
        console.log('Group created successfully:', response);
        this.fetchGroups(); // Refresh the groups list
        this.newGroupName = '';
      },
      (error) => {
        console.error('Error creating group:', error);

      }
    );
  }

  addUser(selectedGroup: any, username: string) {
    console.log('Adding user to group:', { group: selectedGroup.name, user: username });
    const data = {
      groupName: selectedGroup.name,
      username: username,
    };

    this.chatService.addUserToGroup(data).subscribe(
      (response) => {
        console.log('User added to group successfully:', response);
        this.fetchGroups();
        this.toggleAddGroupUser();
      },
      (error) => {
        console.error('Error adding user to group:', error);

      }
    );
  }

  toggleAddGroupUser() {
    this.filteredUsers = this.users.filter(user => !this.selectedGroup.members.includes(user.username));
    this.showAddGroupUser = !this.showAddGroupUser;
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.totalUnreadCount = 0;
    }
  }

  onTypingGroup() {
    if (this.selectedGroup?.name) {  // Use optional chaining
      this.chatService.emitGroupTyping(this.selectedGroup.name, true);

      // Stop typing indicator after 2 seconds
      setTimeout(() => {
        if (this.selectedGroup?.name) {  // Check if still in the same group
          this.chatService.emitGroupTyping(this.selectedGroup.name, false);
        }
      }, 500);
    }
  }

  private scrollToBottom(): void {
    try {
      // Scroll private chat
      if (this.chatBody && this.selectedUser) {
        const element = this.chatBody.nativeElement;
        element.scrollTop = element.scrollHeight;
      }

      // Scroll group chat
      if (this.groupChatBody && this.selectedGroup) {
        const element = this.groupChatBody.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  // Add this method to count contacts with unread messages
  getUnreadContactsCount(): number {
    const usersWithUnread = this.users.filter(user => (user.unreadCount || 0) > 0).length;
    const groupsWithUnread = this.groups.filter(group => (group.unreadCount || 0) > 0).length;
    return usersWithUnread + groupsWithUnread;
  }

  private updateUnreadCounts(messages: ChatMessage[]): void {
    // Get the latest message
    const latestMessage = messages[messages.length - 1];

    // Update unread count for private messages
    if (latestMessage.receiver === this.currentUser &&
        latestMessage.sender !== this.selectedUser &&
        latestMessage.sender !== this.currentUser) {
      const user = this.users.find(u => u.username === latestMessage.sender);
      if (user) {
        user.unreadCount = (user.unreadCount || 0) + 1;
        this.updateTotalUnreadCount();
      }
    }

    // Update unread count for group messages
    if (latestMessage.group &&
        latestMessage.sender !== this.currentUser &&
        (!latestMessage.readBy?.includes(this.currentUser))) {
      const group = this.groups.find(g => g.name === latestMessage.group);
      // Only increment unread count if not currently viewing this group
      if (group && (!this.selectedGroup || latestMessage.group !== this.selectedGroup.name)) {
        group.unreadCount = (group.unreadCount || 0) + 1;
        this.updateTotalUnreadCount();
      }
    }
  }
}
